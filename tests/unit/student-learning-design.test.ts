import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("l'accueil membre est personnalisé, chaleureux et compatible thème", () => {
  const source = readFileSync("src/components/features/marketing/member-home.tsx", "utf8");
  assert.match(source, /Bonjour\{firstName/);
  assert.doesNotMatch(source, /Votre espace personnel/);
  assert.match(source, /bg-gradient-to-br/);
  assert.match(source, /var\(--brand-primary\)/);
  assert.match(source, /var\(--brand-accent\)/);
  assert.match(source, /Votre prochaine compétence commence ici/);
});

test("mon apprentissage distingue les états et reste responsive", () => {
  const page = readFileSync("src/app/apprentissage/page.tsx", "utf8");
  const card = readFileSync("src/components/features/learning/enrollment-card.tsx", "utf8");
  assert.match(page, /À commencer/);
  assert.match(page, /En cours/);
  assert.match(page, /Terminées/);
  assert.match(page, /grid-cols-2[^"]+sm:grid-cols-4/);
  assert.match(page, /3xl:grid-cols-4/);
  assert.match(page, /4xl:grid-cols-6/);
  assert.match(page, /max-w-\[3840px\]/);
  assert.match(page, /dark:text-blue-300/);
  assert.match(card, /À commencer/);
  assert.match(card, /En cours/);
  assert.match(card, /Terminé/);
  assert.match(card, /Attestation disponible/);
  assert.match(card, /brand-success/);
  assert.match(card, /brand-secondary/);
});

test("la vue d'ensemble du cours différencie progression, programme et attestation", () => {
  const source = readFileSync("src/app/apprentissage/[slug]/page.tsx", "utf8");
  assert.match(source, /brand-secondary/);
  assert.match(source, /brand-warning/);
  assert.match(source, /bg-gradient-to-br/);
  assert.match(source, /Attestation/);
  assert.match(source, /Programme/);
  assert.match(source, /3xl:grid-cols-\[360px_minmax\(0,1fr\)\]/);
  assert.match(source, /4xl:grid-cols-\[440px_minmax\(0,1fr\)\]/);
});

test("le lecteur de leçon exploite progressivement les écrans jusqu'au 5K", () => {
  const page = readFileSync(
    "src/app/apprentissage/[slug]/lecons/[lessonId]/page.tsx",
    "utf8",
  );
  const header = readFileSync(
    "src/components/features/learning/learning-header.tsx",
    "utf8",
  );

  assert.match(page, /max-w-\[4608px\]/);
  assert.match(page, /4xl:grid-cols-\[minmax\(0,1fr\)_560px\]/);
  assert.match(page, /4xl:max-w-\[3200px\]/);
  assert.match(page, /4xl:top-16/);
  assert.match(header, /4xl:h-16/);
  assert.doesNotMatch(page, /max-w-\[1600px\] grid-cols/);
});

test("la coquille de compte accepte une largeur dédiée sans élargir les autres espaces", () => {
  const accountShell = readFileSync(
    "src/components/features/workspace/account-shell.tsx",
    "utf8",
  );
  const workspaceShell = readFileSync(
    "src/components/features/workspace/workspace-shell.tsx",
    "utf8",
  );

  assert.match(accountShell, /contentClassName\?: string/);
  assert.match(accountShell, /contentClassName=\{contentClassName\}/);
  assert.match(workspaceShell, /contentClassName\?: string/);
  assert.match(workspaceShell, /cn\([\s\S]+contentClassName/);
  assert.match(workspaceShell, /max-w-\[2400px\]/);
});

function luminance(hex: string): number {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(foreground: string, background: string): number {
  const [bright, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (bright + 0.05) / (dark + 0.05);
}

test("les nouveaux petits textes informatifs respectent WCAG AA en clair et sombre", () => {
  // Tailwind: emerald-700/300/900, blue-600/300; surfaces réelles globals.css.
  assert.ok(contrast("#047857", "#ffffff") >= 4.5, "emerald-700 sur fond clair");
  assert.ok(contrast("#6ee7b7", "#0f172a") >= 4.5, "emerald-300 sur card sombre");
  assert.ok(contrast("#ffffff", "#047857") >= 4.5, "badge Terminé clair");
  assert.ok(contrast("#a7f3d0", "#064e3b") >= 4.5, "badge Terminé sombre");
  assert.ok(contrast("#2563eb", "#ffffff") >= 4.5, "bleu marque sur fond clair");
  assert.ok(contrast("#93c5fd", "#0b1220") >= 4.5, "blue-300 sur fond sombre");
});

test("les états vides de l'apprenant invitent au lieu de constater", () => {
  const empty = readFileSync("src/components/ui/empty-state.tsx", "utf8");
  const page = readFileSync("src/app/apprentissage/page.tsx", "utf8");
  // Le registre chaleureux est OPTIONNEL : les 30+ états vides d'administration
  // gardent le rendu discret d'origine, seul l'espace apprenant y souscrit.
  assert.match(empty, /tone\?: EmptyStateTone/);
  assert.match(empty, /tone = "neutral"/);
  assert.match(empty, /rounded-lg border-dashed border-border bg-muted\/20 p-10/); // neutre inchangé
  assert.equal((page.match(/tone="brand"/g) ?? []).length, 2);
});

test("les onglets de filtre portent un état actif visible, pas un simple filet", () => {
  const tabs = readFileSync("src/components/features/learning/learning-filter-tabs.tsx", "utf8");
  assert.match(tabs, /bg-\[color:var\(--brand-secondary\)\]\/8/);
  assert.match(tabs, /hover:bg-muted\/60/);
  assert.match(tabs, /aria-current=\{isActive \? "page" : undefined\}/);
});
