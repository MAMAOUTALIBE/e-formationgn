import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  getPublishCriteria,
  PLACEHOLDER_DESCRIPTION,
} from "../../src/lib/validators/course-publish";

const root = process.cwd();

test("la porte de publication reste bloquée pour le contenu par défaut", () => {
  const criteria = getPublishCriteria({
    title: "Cours valide",
    description: PLACEHOLDER_DESCRIPTION,
    thumbnailUrl: null,
    sections: [{ lessons: [{}] }],
  });

  assert.equal(criteria.find((criterion) => criterion.key === "description")?.ok, false);
  assert.equal(criteria.find((criterion) => criterion.key === "thumbnail")?.ok, false);
  assert.equal(criteria.find((criterion) => criterion.key === "section")?.ok, true);
  assert.equal(criteria.find((criterion) => criterion.key === "lesson")?.ok, true);
});

test("la fiche admin garde la grille compacte, les onglets et la suppression confirmée", async () => {
  const [pageSource, workspaceSource, stylesSource, grantSource, dialogSource, bulkGrantSource, managementSource, heroBackgroundSource] = await Promise.all([
    readFile(path.join(root, "src/app/admin/cours/[id]/page.tsx"), "utf8"),
    readFile(path.join(root, "src/components/features/admin/course-detail-workspace.tsx"), "utf8"),
    readFile(path.join(root, "src/app/globals.css"), "utf8"),
    readFile(path.join(root, "src/server/actions/admin-enrollments.ts"), "utf8"),
    readFile(path.join(root, "src/components/ui/confirm-dialog.tsx"), "utf8"),
    readFile(path.join(root, "src/components/features/admin/bulk-course-grant.tsx"), "utf8"),
    readFile(path.join(root, "src/components/features/admin/course-management-panel.tsx"), "utf8"),
    readFile(path.join(root, "src/components/features/admin/course-hero-background-form.tsx"), "utf8"),
  ]);

  assert.match(pageSource, /data-testid="admin-course-detail"/);
  assert.match(pageSource, /target="_blank"/);
  assert.match(pageSource, /\/formateur\/cours\/\$\{course\.id\}/);
  assert.match(pageSource, /CourseDetailActions/);
  assert.doesNotMatch(pageSource, /Zone de danger|Curation/);

  assert.match(workspaceSource, /xl:grid-cols-12/);
  assert.match(workspaceSource, /xl:items-start/);
  assert.match(workspaceSource, /xl:col-span-8 xl:grid xl:min-h-0/);
  assert.match(workspaceSource, /xl:sticky xl:top-0 xl:col-span-4/);
  assert.match(workspaceSource, /xl:grid-rows-\[auto_auto_minmax\(32rem,auto\)\]/);
  assert.match(workspaceSource, /xl:grid-rows-\[auto_auto\]/);
  assert.match(workspaceSource, /role="tablist"/);
  assert.match(workspaceSource, /ArrowRight/);

  assert.match(stylesSource, /workspace-shell:has\(\.page-course-detail\) \.workspace-footer/);
  assert.doesNotMatch(stylesSource, /workspace-main:has\(\.page-course-detail\)\s*\{[^}]*overflow:\s*hidden/);
  assert.doesNotMatch(stylesSource, /\.page-course-detail\s*\{[^}]*height:\s*100%/);

  assert.match(grantSource, /loadCourseGrantCandidates/);
  assert.match(grantSource, /skip: offset/);
  assert.match(grantSource, /take: limit/);
  assert.match(bulkGrantSource, /min-h-24 flex-1 overflow-y-auto/);
  assert.match(bulkGrantSource, /gap-2 xl:gap-1/);
  assert.match(bulkGrantSource, /shrink-0 xl:h-7/);
  assert.doesNotMatch(bulkGrantSource, /sticky bottom-0/);
  assert.match(pageSource, /min-h-0 flex-1 px-4 pb-2\.5 xl:pb-0/);
  assert.match(managementSource, /flex-1 resize-none xl:!min-h-12/);
  assert.match(managementSource, /truncate text-sm font-medium text-foreground xl:whitespace-nowrap/);
  assert.match(managementSource, /xl:shrink-0 xl:whitespace-nowrap/);
  assert.match(managementSource, /min-w-0 flex-1 truncate text-xs text-muted-foreground xl:text-right/);
  assert.match(managementSource, /CourseHeroBackgroundForm/);
  assert.match(heroBackgroundSource, /Image d’arrière-plan du hero/);
  assert.match(heroBackgroundSource, /Conserver l’image actuelle/);
  assert.match(heroBackgroundSource, /Restaurer l’image par défaut/);
  assert.match(heroBackgroundSource, /Supprimer l’image actuelle/);
  assert.match(heroBackgroundSource, /object-cover object-center/);

  assert.match(dialogSource, /aria-labelledby=\{titleId\}/);
  assert.match(dialogSource, /aria-describedby=\{description \? descriptionId : undefined\}/);
  assert.match(dialogSource, /event\.key !== "Tab"/);
  assert.match(dialogSource, /previouslyFocusedRef/);
});
