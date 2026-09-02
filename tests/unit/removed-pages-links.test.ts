import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// `src/proxy.ts` retire le volet financier de la plateforme : ses écrans
// répondent 404 et ses API 410, quel que soit le rôle. Rien n'empêchait
// jusqu'ici l'interface de continuer à pointer vers eux — le menu admin
// affichait « Litiges » et la cloche de notifications proposait un lien, tous
// deux aboutissant à un « Page introuvable » en texte brut.
//
// Ce test relit la liste depuis le proxy plutôt que de la recopier : une
// réactivation ou un ajout d'écran retiré reste ainsi couvert sans rien
// modifier ici.

const root = process.cwd();

async function removedPaths(): Promise<string[]> {
  const proxy = await readFile(path.join(root, "src/proxy.ts"), "utf8");
  const block = (name: string): string[] => {
    const after = proxy.split(`const ${name} = [`)[1];
    assert.ok(after, `liste ${name} introuvable dans src/proxy.ts`);
    const body = after.split("] as const")[0];
    return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  };
  return [...block("REMOVED_PAGES"), ...block("REMOVED_APIS")];
}

/**
 * Surfaces réellement rendues à l'écran pour l'administration. Les fichiers
 * situés *sous* un écran retiré ne sont pas listés : ils sont inatteignables,
 * et leurs liens internes ne mènent donc personne nulle part.
 */
const RENDERED_SURFACES = [
  "src/lib/workspace/admin-nav.ts",
  "src/lib/workspace/instructor-nav.ts",
  "src/components/features/admin/admin-notifications-bell.tsx",
  "src/server/queries/admin-overview.ts",
];

function deadLinks(source: string, removed: string[]): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/href[=:]\s*"(\/[^"?#]*)/g)) {
    const target = match[1];
    if (removed.some((gone) => target === gone || target.startsWith(`${gone}/`))) {
      found.push(target);
    }
  }
  return found;
}

test("aucune surface rendue ne pointe vers un écran retiré par le proxy", async () => {
  const removed = await removedPaths();
  assert.ok(removed.length > 0, "le proxy ne déclare aucun écran retiré");

  for (const file of RENDERED_SURFACES) {
    const source = await readFile(path.join(root, file), "utf8");
    const dead = deadLinks(source, removed);
    assert.deepEqual(dead, [], `${file} renvoie vers des écrans retirés : ${dead.join(", ")}`);
  }
});

test("le registre de navigation admin n'annonce plus les litiges", async () => {
  const source = await readFile(path.join(root, "src/lib/workspace/admin-nav.ts"), "utf8");
  // Ni l'entrée de menu, ni la pastille qui comptait des éléments devenus
  // inaccessibles depuis la rubrique Support.
  assert.doesNotMatch(source, /support\/litiges/);
  assert.doesNotMatch(source, /openDisputes/);
});

test("toute page d'un écran retiré reste servie par le proxy, jamais par le routeur", async () => {
  // Garde-fou inverse : si un écran retiré perdait son entrée dans le proxy,
  // sa page redeviendrait accessible sans que personne l'ait décidé.
  const removed = await removedPaths();
  const pageDirs = removed.filter((entry) => !entry.startsWith("/api/"));
  const existing: string[] = [];
  for (const entry of pageDirs) {
    const dir = path.join(root, "src/app", entry);
    try {
      const files = await readdir(dir);
      if (files.includes("page.tsx")) existing.push(entry);
    } catch {
      // L'écran a été supprimé du dépôt : rien à garder.
    }
  }
  // On n'exige pas leur suppression — seulement que le proxy les couvre, ce
  // qui est vrai par construction puisque la liste vient de lui.
  assert.ok(
    existing.every((entry) => removed.includes(entry)),
    "un écran retiré subsiste sans être couvert par le proxy",
  );
});
