import assert from "node:assert/strict";
import test from "node:test";

import { joinFullName, splitFullName } from "../../src/lib/identity-name";
import {
  civilStatusSchema,
  createCenterAccountSchema,
  readCivilStatusFields,
} from "../../src/lib/validators/identity";

test("le découpage inverse exactement la construction historique du nom", () => {
  // `name` était bâti comme `${firstName} ${lastName}` : les comptes déjà en
  // base doivent faire l'aller-retour sans se déformer.
  const split = splitFullName("Aïssatou Camara");
  assert.equal(split.firstName, "Aïssatou");
  assert.equal(split.lastName, "Camara");
  assert.equal(split.name, "Aïssatou Camara");
});

test("un nom composé garde ses parties du bon côté", () => {
  const split = splitFullName("  Mamadou   Alpha Barry  ");
  assert.equal(split.name, "Mamadou Alpha Barry", "espaces normalisés");
  assert.equal(split.firstName, "Mamadou");
  assert.equal(split.lastName, "Alpha Barry");
});

test("un mononyme se classe avec les noms de famille", () => {
  const split = splitFullName("Sekou");
  assert.equal(split.firstName, null);
  assert.equal(split.lastName, "Sekou");
  assert.equal(split.name, "Sekou");
});

test("le nom affiché vient de `name`, les colonnes dérivées ne servent que de repli", () => {
  assert.equal(
    joinFullName({ name: "BARRY Mamadou", firstName: "X", lastName: "Y" }),
    "BARRY Mamadou",
  );
  assert.equal(
    joinFullName({ name: null, firstName: "Aïssatou", lastName: "Camara" }),
    "Aïssatou Camara",
  );
  assert.equal(joinFullName({ name: "   ", firstName: null, lastName: null }), "");
});

const baseFields = {
  fullName: "Aïssatou Camara",
  birthDate: "",
  birthPlace: "",
  gender: "",
  phone: "",
  country: "",
  address: "",
};

test("les champs facultatifs vides deviennent null, pas des chaînes vides", () => {
  const parsed = civilStatusSchema.parse(baseFields);
  assert.equal(parsed.birthDate, null);
  assert.equal(parsed.birthPlace, null);
  assert.equal(parsed.gender, null, "vide signifie non renseigné, jamais « autre »");
  assert.equal(parsed.phone, null);
  assert.equal(parsed.address, null);
});

test("la date de naissance est ancrée à midi UTC", () => {
  // À minuit, un serveur à l'ouest de Greenwich reculerait la date d'un jour
  // au moment d'écrire la colonne DATE.
  const parsed = civilStatusSchema.parse({ ...baseFields, birthDate: "1994-03-08" });
  assert.ok(parsed.birthDate instanceof Date);
  assert.equal(parsed.birthDate.toISOString(), "1994-03-08T12:00:00.000Z");
});

test("une date de naissance future ou improbable est refusée", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  assert.equal(
    civilStatusSchema.safeParse({ ...baseFields, birthDate: future }).success,
    false,
  );
  assert.equal(
    civilStatusSchema.safeParse({ ...baseFields, birthDate: "1492-01-01" }).success,
    false,
  );
  assert.equal(
    civilStatusSchema.safeParse({ ...baseFields, birthDate: "08/03/1994" }).success,
    false,
  );
});

test("un nom complet trop court est refusé", () => {
  assert.equal(
    civilStatusSchema.safeParse({ ...baseFields, fullName: "A" }).success,
    false,
  );
  assert.equal(
    civilStatusSchema.safeParse({ ...baseFields, fullName: "   " }).success,
    false,
  );
});

test("le sexe n'accepte que les valeurs de l'énumération", () => {
  assert.equal(
    civilStatusSchema.safeParse({ ...baseFields, gender: "FEMALE" }).success,
    true,
  );
  assert.equal(
    civilStatusSchema.safeParse({ ...baseFields, gender: "F" }).success,
    false,
  );
});

// --- Schéma de création de compte -----------------------------------------

test("la création accepte un dossier complet et normalise ce qu'elle reçoit", () => {
  const form = new FormData();
  form.set("fullName", "  Mamadou   Alpha Barry ");
  form.set("birthDate", "1994-03-08");
  form.set("birthPlace", "Conakry");
  form.set("gender", "MALE");
  form.set("phone", "+224 620 00 00 00");
  form.set("country", "Guinée");
  form.set("address", "Quartier Kaloum, Conakry");

  const parsed = createCenterAccountSchema.safeParse({
    ...readCivilStatusFields(form),
    email: "  MAMADOU@Exemple.COM ",
    role: "STUDENT",
    companyId: "cmp_1",
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.email, "mamadou@exemple.com");
  assert.equal(parsed.data.fullName, "Mamadou   Alpha Barry".trim());
  assert.equal(parsed.data.birthDate?.toISOString(), "1994-03-08T12:00:00.000Z");
  assert.equal(parsed.data.gender, "MALE");
});

test("la création refuse une société vide, un rôle privilégié et les clés inconnues", () => {
  const base = {
    fullName: "Aïssatou Camara",
    birthDate: "",
    birthPlace: "",
    gender: "",
    phone: "",
    country: "",
    address: "",
    email: "aissatou@exemple.com",
    role: "STUDENT",
    companyId: "cmp_1",
  };

  assert.equal(createCenterAccountSchema.safeParse(base).success, true);
  assert.equal(
    createCenterAccountSchema.safeParse({ ...base, companyId: "" }).success,
    false,
    "société de rattachement obligatoire",
  );
  assert.equal(
    createCenterAccountSchema.safeParse({ ...base, role: "ADMIN" }).success,
    false,
    "cet écran ne crée pas de compte privilégié",
  );
  assert.equal(
    createCenterAccountSchema.safeParse({ ...base, identityLockedAt: null }).success,
    false,
    ".strict() rejette toute clé forgée",
  );
});
