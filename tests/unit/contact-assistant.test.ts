import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildContactProspectMessage,
  contactAssistantLeadSchema,
} from "../../src/lib/assistant/contact-prospect";

const root = process.cwd();

const validLead = {
  need: "Former notre équipe marketing aux usages concrets de l'IA.",
  name: "Aminata Diallo",
  company: "Exemple Conseil",
  phone: "+33 6 12 34 56 78",
  email: "AMINATA@EXEMPLE.FR",
  training: "Intelligence artificielle appliquée au marketing",
  availability: "Mardi matin",
  consent: true,
};

test("le parcours Contact exige toutes les informations et le consentement", () => {
  const accepted = contactAssistantLeadSchema.safeParse(validLead);
  assert.equal(accepted.success, true);
  if (accepted.success) {
    assert.equal(accepted.data.email, "aminata@exemple.fr");
  }

  assert.equal(
    contactAssistantLeadSchema.safeParse({ ...validLead, consent: false }).success,
    false,
    "aucune écriture ne doit être possible sans consentement explicite",
  );
  assert.equal(
    contactAssistantLeadSchema.safeParse({ ...validLead, phone: "123" }).success,
    false,
    "le téléphone demandé doit être complet",
  );
  assert.equal(
    contactAssistantLeadSchema.safeParse({ ...validLead, company: "" }).success,
    false,
    "l'entreprise doit être recueillie",
  );
});

test("le message du prospect contient la source et le résumé attendus par le CRM", () => {
  const parsed = contactAssistantLeadSchema.parse(validLead);
  const message = buildContactProspectMessage(parsed);

  assert.match(message, /^Source : Aiduca-IA$/m);
  assert.match(message, /^Entreprise : Exemple Conseil$/m);
  assert.match(
    message,
    /^Formation recherchée : Intelligence artificielle appliquée au marketing$/m,
  );
  assert.match(message, /^Disponibilité : Mardi matin$/m);
  assert.match(message, /^Résumé de la conversation :$/m);
  assert.match(message, /Former notre équipe marketing/);
});

test("la page Contact intègre son chatbot sans doubler le widget flottant", async () => {
  const [page, mount, globalCss, assistant] = await Promise.all([
    readFile(path.join(root, "src/app/contact/page.tsx"), "utf8"),
    readFile(
      path.join(
        root,
        "src/components/features/assistant/assistant-mount.tsx",
      ),
      "utf8",
    ),
    readFile(path.join(root, "src/app/globals.css"), "utf8"),
    readFile(
      path.join(
        root,
        "src/components/features/contact/contact-assistant.tsx",
      ),
      "utf8",
    ),
  ]);

  assert.match(page, /<ContactAssistant/);
  assert.match(page, /contact-view/);
  assert.doesNotMatch(page, /<SiteFooter/);
  assert.match(mount, /"\/contact"/);
  assert.match(globalCss, /html:has\(\.contact-view\)/);
  assert.match(globalCss, /body:has\(\.contact-view\)/);
  assert.match(assistant, /h-full min-h-0 flex-col/);
  assert.match(assistant, /min-h-0 flex-1[^"]*overflow-y-auto/);
});

test("l'écriture serveur cible uniquement la liste de prospects existante", async () => {
  const action = await readFile(
    path.join(root, "src/server/actions/assistant.ts"),
    "utf8",
  );

  assert.match(action, /contactAssistantLeadSchema\.safeParse/);
  assert.match(action, /prefix: "contact-assistant-lead"/);
  assert.match(action, /buildContactProspectMessage\(parsed\.data\)/);
  assert.match(action, /prisma\.assistantLead\.create/);
  assert.doesNotMatch(action, /prisma\.company\.create/);
});
