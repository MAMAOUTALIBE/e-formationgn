import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("les surfaces publiques décrivent le mode centre de formation", () => {
  const publicCopy = [
    source("src/app/page.tsx"),
    source("src/components/features/marketing/home-sections.tsx"),
    source("src/components/features/marketing/testimonials.tsx"),
    source("src/components/layout/site-footer.tsx"),
    source("src/app/aide/page.tsx"),
    source("src/app/devenir-formateur/page.tsx"),
  ].join("\n");

  assert.doesNotMatch(publicCopy, /Paiement Mobile Money|Orange Money|MTN MoMo|Abonnement individuel/);
  assert.doesNotMatch(publicCopy, /Conditions et rémunération|accès illimité aux formations/i);
  assert.doesNotMatch(publicCopy, /devenez formateur|Activer mon compte formateur|Créer un compte gratuit/i);
  assert.match(publicCopy, /Les comptes sont créés par le centre de formation/);
  assert.match(publicCopy, /attestation de fin de formation/i);
  assert.match(publicCopy, /compte a été créé et habilité\s+par AIDUCA/i);
  assert.doesNotMatch(publicCopy, /becomeInstructor/);
});

test("la navigation publique n'expose ni recrutement ni inscription libre", () => {
  const navigation = [
    source("src/components/layout/site-header.tsx"),
    source("src/components/layout/mobile-menu.tsx"),
    source("src/components/layout/site-footer.tsx"),
  ].join("\n");
  const home = source("src/app/page.tsx");
  const instructors = source("src/components/features/marketing/home-sections.tsx");

  assert.doesNotMatch(navigation, /href="\/inscription"|href="\/devenir-formateur"/);
  assert.match(navigation, /Contacter le centre/);
  assert.doesNotMatch(home, /HomeTrustedBy|href="\/devenir-formateur"/);
  assert.doesNotMatch(instructors, /devenez formateur|href="\/devenir-formateur"/i);
  assert.equal(existsSync("src/components/features/marketing/trusted-by.tsx"), false);
});

test("les pages d'authentification n'orientent jamais vers une auto-inscription", () => {
  const login = source("src/app/(auth)/connexion/page.tsx");
  const verification = source("src/app/(auth)/verifier-email/page.tsx");
  const registration = source("src/app/(auth)/inscription/page.tsx");

  assert.doesNotMatch(`${login}\n${verification}`, /href="\/inscription"|Créer un compte|Recommencer l'inscription/i);
  assert.match(login, /href="\/contact"[\s\S]*Contacter le centre/);
  assert.match(verification, /Contactez le centre[\s\S]*href="\/contact"/);
  assert.match(registration, /création libre de compte n&apos;est pas disponible/i);
  assert.doesNotMatch(registration, /RegisterForm|GoogleButton|isTrainingCenterMode|Créer un compte gratuitement/i);
});

test("la synchronisation CMS reste en lecture seule sans confirmation explicite", () => {
  const script = source("scripts/sync-center-cms.ts");

  assert.match(script, /--apply/);
  assert.match(script, /--confirm=SYNC_CENTER_CMS/);
  assert.match(script, /if \(apply && !confirmed\)/);
  assert.doesNotMatch(script, /upsert|create\(/);
});

test("les contenus légaux de secours ne décrivent plus la marketplace retirée", () => {
  const cms = source("src/lib/cms.ts");

  assert.match(cms, /L'inscription publique et l'achat en ligne ne sont pas proposés/);
  assert.match(cms, /base PostgreSQL sont hébergées sur un serveur exploité auprès d'Hostinger/);
  assert.match(cms, /ni panier, ni préférence de devise, ni code d'affiliation/);
  assert.doesNotMatch(cms, /Supabase|Stripe|formateurs indépendants/);
  assert.doesNotMatch(cms, /Les prix sont indiqués TTC|politique de remboursement commerciale/);
});

test("le catalogue et les catégories possèdent leur URL Open Graph propre", () => {
  const courses = source("src/app/cours/page.tsx");
  const categories = source("src/app/categories/page.tsx");

  assert.match(courses, /openGraph:\s*\{[\s\S]*?url: "\/cours"/);
  assert.match(categories, /openGraph:\s*\{[\s\S]*?url: "\/categories"/);
});
