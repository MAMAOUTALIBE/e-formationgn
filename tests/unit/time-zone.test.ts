import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMON_TIME_ZONES,
  isSupportedTimeZone,
  safeTimeZone,
  supportedTimeZones,
  utcToZonedDateTimeLocal,
  zonedDateTimeToUtc,
} from "../../src/lib/time-zone";

// Le défaut de production venait précisément de là : le même code donnait un
// instant différent selon le `TZ` du processus. Ces assertions sont écrites en
// valeurs absolues, elles doivent passer quel que soit le fuseau du serveur —
// la suite est rejouée sous `TZ=UTC` et `TZ=Europe/Paris` en intégration.
test("l’heure saisie est ancrée sur le fuseau déclaré, pas sur celui du serveur", () => {
  // Paris en septembre = UTC+2.
  assert.equal(
    zonedDateTimeToUtc("2026-09-01T10:00", "Europe/Paris").toISOString(),
    "2026-09-01T08:00:00.000Z",
  );
  // Conakry ne pratique pas d’heure d’été et reste sur UTC.
  assert.equal(
    zonedDateTimeToUtc("2026-09-01T10:00", "Africa/Conakry").toISOString(),
    "2026-09-01T10:00:00.000Z",
  );
  // Même saisie en janvier : Paris repasse à UTC+1.
  assert.equal(
    zonedDateTimeToUtc("2026-01-15T10:00", "Europe/Paris").toISOString(),
    "2026-01-15T09:00:00.000Z",
  );
  assert.equal(
    zonedDateTimeToUtc("2026-09-01T10:00", "America/Montreal").toISOString(),
    "2026-09-01T14:00:00.000Z",
  );
});

test("une chaîne déjà absolue n’est jamais réinterprétée", () => {
  // La création instantanée envoie un ISO complet : le réinterpréter dans le
  // fuseau de la classe décalerait l’ouverture immédiate.
  assert.equal(
    zonedDateTimeToUtc("2026-09-01T10:00:00.000Z", "Europe/Paris").toISOString(),
    "2026-09-01T10:00:00.000Z",
  );
  assert.equal(
    zonedDateTimeToUtc("2026-09-01T12:00:00+02:00", "Africa/Conakry").toISOString(),
    "2026-09-01T10:00:00.000Z",
  );
});

test("le passage à l’heure d’hiver reste réversible", () => {
  // 25/10/2026 : Paris recule d’une heure à 03:00 locale.
  for (const local of ["2026-10-25T01:30", "2026-10-25T04:30", "2026-03-29T04:30"]) {
    const utc = zonedDateTimeToUtc(local, "Europe/Paris");
    assert.equal(utcToZonedDateTimeLocal(utc, "Europe/Paris"), local);
  }
});

test("l’aller-retour saisie → base → formulaire conserve la valeur", () => {
  for (const zone of ["Europe/Paris", "Africa/Conakry", "Asia/Tokyo", "UTC"]) {
    const local = "2026-09-01T10:00";
    assert.equal(
      utcToZonedDateTimeLocal(zonedDateTimeToUtc(local, zone), zone),
      local,
      `aller-retour cassé pour ${zone}`,
    );
  }
});

test("un fuseau invalide est refusé puis remplacé au lieu de faire lever Intl", () => {
  assert.equal(isSupportedTimeZone("Europe/Paris"), true);
  assert.equal(isSupportedTimeZone("Africa/Conakry"), true);
  // Saisies plausibles d’un administrateur avant la correction : chacune
  // faisait lever `RangeError` au rendu des trois listes de séances.
  for (const invalid of ["Paris", "GMT+1", "", "  ", null, undefined, 42]) {
    assert.equal(isSupportedTimeZone(invalid), false);
    assert.equal(safeTimeZone(invalid), "Europe/Paris");
  }
  // Le repli doit rester formatable, sinon on n’a fait que déplacer la panne.
  assert.doesNotThrow(() =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: safeTimeZone("Paris") }).format(new Date()),
  );
});

test("la liste proposée ne contient que des fuseaux réellement formatables", () => {
  for (const zone of COMMON_TIME_ZONES) {
    assert.equal(isSupportedTimeZone(zone), true, `${zone} inconnu du moteur`);
  }
  const all = supportedTimeZones();
  assert.ok(all.length > 0);
  assert.ok(all.includes("Europe/Paris"));
});
