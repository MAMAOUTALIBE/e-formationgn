import assert from "node:assert/strict";
import test from "node:test";

import { parseStudentCsv } from "../../src/lib/admin/csv-students";

test("l'ordre historique prénom / nom / email reste lu sans en-tête", () => {
  // Les fichiers déjà en circulation n'ont pas d'en-tête : les casser en
  // ajoutant la lecture nommée aurait été le vrai risque de cette évolution.
  const { rows, errors } = parseStudentCsv(
    "Mamadou;Barry;mamadou@exemple.org\nAïssatou;Camara;aissatou@exemple.org",
  );
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fullName, "Mamadou Barry");
  assert.equal(rows[0].email, "mamadou@exemple.org");
});

test("avec en-tête, l'ordre des colonnes cesse de compter", () => {
  const { rows, errors } = parseStudentCsv(
    [
      "Email;Sexe;Nom et prénom;Date de naissance;Pays",
      "MAMADOU@Exemple.ORG;MALE;Mamadou Alpha Barry;1994-03-08;Guinée",
    ].join("\n"),
  );
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fullName, "Mamadou Alpha Barry");
  assert.equal(rows[0].email, "mamadou@exemple.org", "email normalisé en minuscules");
  assert.equal(rows[0].birthDate, "1994-03-08");
  assert.equal(rows[0].gender, "MALE");
  assert.equal(rows[0].country, "Guinée");
});

test("les intitulés d'en-tête tolèrent accents, casse et ponctuation", () => {
  const { rows } = parseStudentCsv(
    ["  DATE DE NAISSANCE ;Courriel;NOM ET PRÉNOM", "1990-01-02;a@b.co;Sekou"].join("\n"),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fullName, "Sekou");
  assert.equal(rows[0].birthDate, "1990-01-02");
});

test("un en-tête donnant prénom et nom séparés recompose le nom complet", () => {
  const { rows } = parseStudentCsv(
    ["Prénom;Nom de famille;Email", "Aïssatou;Camara;aissatou@exemple.org"].join("\n"),
  );
  assert.equal(rows[0].fullName, "Aïssatou Camara");
});

test("les colonnes surnuméraires d'un export sont ignorées", () => {
  // C'est ce qui permet de réimporter un export de la plateforme sans le
  // retailler à la main.
  const { rows, errors } = parseStudentCsv(
    [
      "id;nom et prenom;email;statut;role;isInstructor;createdAt",
      "usr_1;Fatou Diallo;fatou@exemple.org;ACTIVE;STUDENT;non;2026-01-01",
    ].join("\n"),
  );
  assert.deepEqual(errors, []);
  assert.equal(rows[0].fullName, "Fatou Diallo");
  assert.equal(rows[0].email, "fatou@exemple.org");
});

test("un compte interne est refusé, quelle que soit la forme du fichier", () => {
  const positional = parseStudentCsv("Awa;Diallo;awa@exemple.org;Formateur");
  assert.equal(positional.rows.length, 0);
  assert.match(positional.errors[0].reason, /compte interne/i);

  const named = parseStudentCsv(
    ["Email;Nom et prénom;Rôle", "awa@exemple.org;Awa Diallo;gestionnaire"].join("\n"),
  );
  assert.equal(named.rows.length, 0);
  assert.match(named.errors[0].reason, /compte interne/i);
});

test("email invalide, nom manquant et doublon sont signalés ligne par ligne", () => {
  const { rows, errors } = parseStudentCsv(
    [
      "Mamadou;Barry;pas-un-email",
      ";;vide@exemple.org",
      "Awa;Diallo;awa@exemple.org",
      "Awa;Diallo;AWA@exemple.org",
    ].join("\n"),
  );
  assert.equal(rows.length, 1, "seule la ligne saine est retenue");
  assert.equal(errors.length, 3);
  assert.match(errors[0].reason, /Email invalide/);
  assert.match(errors[1].reason, /Nom et prénom manquants/);
  assert.match(errors[2].reason, /double/i);
  // Le numéro de ligne doit situer l'erreur dans le fichier d'origine.
  assert.deepEqual(errors.map((e) => e.line), [1, 2, 4]);
});

test("les particularités d'un export Excel français sont absorbées", () => {
  // BOM UTF-8, CRLF et point-virgule : le trio d'un « Enregistrer sous CSV ».
  const raw = "﻿Prénom;Nom;Email\r\nMamadou;Barry;mamadou@exemple.org\r\n";
  const { rows, errors } = parseStudentCsv(raw);
  assert.deepEqual(errors, []);
  assert.equal(rows[0].fullName, "Mamadou Barry");
});

test("un copier-coller en tabulations est reconnu", () => {
  const { rows } = parseStudentCsv("Mamadou\tBarry\tmamadou@exemple.org");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fullName, "Mamadou Barry");
});

test("un champ cité contenant le séparateur reste entier", () => {
  const { rows } = parseStudentCsv(
    ['Nom et prénom;Email;Adresse', '"Barry, Mamadou";m@b.co;"Kaloum; Conakry"'].join("\n"),
  );
  assert.equal(rows[0].fullName, "Barry, Mamadou");
  assert.equal(rows[0].address, "Kaloum; Conakry");
});
