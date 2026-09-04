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
    // Le contenu de la FAQ a été extrait vers @/lib/help-faq pour être partagé
    // avec la base documentaire d'Aiduca-IA. La page le rend toujours ; c'est
    // le fichier qui le porte qui a changé, pas la copie publique.
    source("src/lib/help-faq.ts"),
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
  assert.match(cms, /Hostinger/);
  assert.match(cms, /ni panier, ni préférence de devise, ni code d'affiliation/);
  assert.doesNotMatch(cms, /Supabase|Stripe|formateurs indépendants/);
  assert.doesNotMatch(cms, /Les prix sont indiqués TTC|politique de remboursement commerciale/);
});

test("la politique de confidentialité porte les mentions obligatoires de l'article 13", () => {
  const cms = source("src/lib/cms.ts");

  // Le droit de réclamation auprès de la CNIL et le droit à la limitation
  // manquaient tous deux : ce sont les deux omissions les plus fréquemment
  // relevées lors d'un contrôle.
  assert.match(cms, /CNIL/);
  assert.match(cms, /limitation du traitement/);
  assert.match(cms, /portabilité/);

  // Les sous-traitants doivent être nommés, et les transferts hors UE encadrés.
  for (const soustraitant of ["Hostinger", "Mux", "Cloudflare", "Resend", "Groq"]) {
    assert.match(cms, new RegExp(soustraitant), `sous-traitant non déclaré : ${soustraitant}`);
  }
  assert.match(cms, /hors de l'Union européenne|hors Union européenne/);
  assert.match(cms, /clauses contractuelles types|cadre de protection des données/);

  // Des durées chiffrées, et non « les durées peuvent varier ».
  assert.match(cms, /90 jours/);
  assert.match(cms, /180 jours/);
  assert.doesNotMatch(cms, /Les durées précises peuvent varier/);
});

test("aucune mention légale publiée ne comporte de marqueur à compléter", () => {
  // Un « [à compléter] » sur une page légale publique coûte plus en crédibilité
  // qu'il ne rappelle la tâche. Les valeurs manquantes sont donc absentes de la
  // page, et réclamées par le test suivant.
  const cms = source("src/lib/cms.ts");
  const contenus = cms.split("body: `").slice(1).map((bloc) => bloc.split("`,")[0]);
  for (const contenu of contenus) {
    assert.doesNotMatch(
      contenu,
      /\[[^\]]*(compléter|à définir|TODO|XXX)[^\]]*\]/i,
      "un contenu CMS publié contient un marqueur de rédaction",
    );
  }
});

test("mentions légales : les valeurs encore attendues du centre sont signalées", () => {
  // Ce test n'échoue PAS sur l'absence de ces valeurs : elles ne dépendent pas
  // du code, seul le centre les détient, et bloquer tout déploiement dessus
  // serait disproportionné. Il les énumère bruyamment, comme le script de
  // déploiement le fait déjà pour Turnstile et Sentry.
  //
  // Ce qu'il vérifie réellement : que la page ne se dégrade pas — soit la
  // mention est complète, soit elle est absente, jamais un « [à compléter] »
  // exposé au visiteur.
  const cms = source("src/lib/cms.ts");
  const manquantes: string[] = [];

  // Capital social : obligatoire pour une société (LCEN art. 6-III-1).
  if (!/au capital (social )?de [\d  ]+ euros/i.test(cms)) {
    manquantes.push("capital social de la SAS");
  }
  // Directeur de la publication : obligatoire, sans exception (LCEN art. 6-III-1 e).
  if (!/Directeur de la publication : [A-ZÉÈÀ]/.test(cms)) {
    manquantes.push("nom du directeur de la publication");
  }

  if (manquantes.length > 0) {
    console.warn(
      `\n  ⚠️  Mentions légales incomplètes (LCEN art. 6-III-1) — à obtenir du centre :\n` +
        manquantes.map((m) => `      · ${m}`).join("\n") +
        `\n      Compléter dans src/lib/cms.ts ou depuis /admin/cms.\n`,
    );
  }

  // Ce qui est vérifié, lui, est bloquant : une mention à demi rédigée ne doit
  // jamais atteindre la page publique.
  const mentions = cms.split('"mentions-legales"')[1]?.split("body: `")[1]?.split("`,")[0] ?? "";
  assert.doesNotMatch(mentions, /\[[^\]]+\]/, "mention légale laissée à demi rédigée");
  assert.match(mentions, /société par actions simplifiée/);
});

test("les mentions légales portent l'hébergeur et la formule imposée aux organismes de formation", () => {
  const cms = source("src/lib/cms.ts");

  // Obligation explicite de la LCEN, purement et simplement absente.
  assert.match(cms, /Hébergement du site/);
  assert.match(cms, /Hostinger International/);

  // Formule imposée par l'article L.6352-12 du Code du travail, à porter avec
  // le numéro de déclaration d'activité.
  assert.match(cms, /Cet enregistrement ne vaut pas agrément de l'État/);

  assert.match(cms, /RCS/);
  assert.match(cms, /TVA : exonérée au titre de l'article 261-4-4°a/);
});

test("le catalogue et les catégories possèdent leur URL Open Graph propre", () => {
  const courses = source("src/app/cours/page.tsx");
  const categories = source("src/app/categories/page.tsx");

  assert.match(courses, /openGraph:\s*\{[\s\S]*?url: "\/cours"/);
  assert.match(categories, /openGraph:\s*\{[\s\S]*?url: "\/categories"/);
});
