import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { allOf, parseListFilter } from "../../src/lib/admin/list-filters";

const root = process.cwd();

test("un filtre inconnu est ignoré, jamais transmis tel quel", () => {
  const statuses = ["ACTIVE", "SUSPENDED", "DELETED"] as const;

  assert.equal(parseListFilter("ACTIVE", statuses), "ACTIVE");
  assert.equal(parseListFilter("  ACTIVE  ", statuses), "ACTIVE");
  assert.equal(parseListFilter("", statuses), undefined);
  assert.equal(parseListFilter(undefined, statuses), undefined);
  assert.equal(parseListFilter("INCONNU", statuses), undefined);
  // Comparaison stricte : laisser passer l'approximation reviendrait à
  // inventer une intention que l'opérateur n'a pas exprimée.
  assert.equal(parseListFilter("active", statuses), undefined);
  assert.equal(parseListFilter("actif", statuses), undefined);
});

test("deux critères se combinent en ET, chacun gardant son propre OU", () => {
  const combined = allOf<Record<string, unknown>>([
    [{ name: "a" }, { email: "a" }],
    [{ lastLoginAt: null }, { lastLoginAt: { lt: 1 } }],
  ]);

  // Le défaut corrigé : empilés dans un même OR, « chercher Camara chez les
  // inactifs » renvoyait tous les Camara PLUS tous les inactifs.
  assert.deepEqual(combined, {
    AND: [
      { OR: [{ name: "a" }, { email: "a" }] },
      { OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: 1 } }] },
    ],
  });
});

test("un groupe unique ne s'entoure pas d'un OU inutile", () => {
  assert.deepEqual(allOf<Record<string, unknown>>([[{ name: "a" }]]), {
    AND: [{ name: "a" }],
  });
  assert.equal(allOf([undefined, []]), undefined);
});

test("la liste des apprenants n'empile plus recherche et inactivité", async () => {
  const source = await readFile(
    path.join(root, "src/server/queries/admin-users.ts"),
    "utf8",
  );
  assert.match(source, /allOf<Prisma\.UserWhereInput>/);
  assert.doesNotMatch(
    source,
    /ors\.push/,
    "les critères ne doivent plus partager un tableau OR unique",
  );
});

test("chaque liste d'administration valide ses filtres d'URL", async () => {
  const pages = [
    "src/app/admin/utilisateurs/page.tsx",
    "src/app/admin/cours/page.tsx",
    "src/app/admin/formations/page.tsx",
    "src/app/admin/societes/page.tsx",
    "src/app/admin/formateurs/page.tsx",
  ];

  for (const relative of pages) {
    const source = await readFile(path.join(root, relative), "utf8");
    assert.match(
      source,
      /parseListFilter\(/,
      `${relative} doit borner ses paramètres d'URL`,
    );
  }
});

test("le compteur de formateurs suit le filtre de la liste", async () => {
  const source = await readFile(
    path.join(root, "src/app/admin/formateurs/page.tsx"),
    "utf8",
  );
  // Il comptait tous les formateurs quel que soit le filtre : une ligne
  // affichée sous un compteur qui en annonçait quarante.
  assert.doesNotMatch(source, /count\(\{ where: \{ isInstructor: true \} \}\)/);
  assert.match(source, /prisma\.user\.count\(\{ where \}\)/);
});
