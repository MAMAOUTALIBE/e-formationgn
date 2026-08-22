import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildProfileUpdate,
  canUpdateProfileIdentity,
} from "../../src/lib/profile-update";
import { updateStudentPublicProfileSchema } from "../../src/lib/validators/auth";

test("une requête forgée d'apprenant ignore toute modification d'identité", () => {
  const forgedPayload = {
    firstName: "Prénom forgé",
    lastName: "Nom forgé",
    name: "Identité forgée",
    headline: "Développeuse web",
    bio: "Profil public",
    websiteUrl: "",
    linkedinUrl: "https://www.linkedin.com/in/apprenante",
    facebookUrl: "https://www.facebook.com/apprenante",
    twitterUrl: "",
    youtubeUrl: "https://www.youtube.com/@apprenante",
  };

  const parsed = updateStudentPublicProfileSchema.parse(forgedPayload);
  const update = buildProfileUpdate({ role: "STUDENT" }, parsed);

  assert.equal("firstName" in update, false);
  assert.equal("lastName" in update, false);
  assert.equal("name" in update, false);
  assert.equal(update.headline, "Développeuse web");
  assert.equal(update.linkedinUrl, "https://www.linkedin.com/in/apprenante");
  assert.equal(update.facebookUrl, "https://www.facebook.com/apprenante");
  assert.equal(update.youtubeUrl, "https://www.youtube.com/@apprenante");
});

test("les autres rôles conservent la mise à jour de leur identité", () => {
  const update = buildProfileUpdate(
    { role: "INSTRUCTOR" },
    {
      firstName: "Aïssatou",
      lastName: "Camara",
      headline: "Formatrice",
      bio: "",
      websiteUrl: "",
      linkedinUrl: "",
      facebookUrl: "",
      twitterUrl: "",
      youtubeUrl: "",
    },
  );

  assert.equal(update.firstName, "Aïssatou");
  assert.equal(update.lastName, "Camara");
  assert.equal(update.name, "Aïssatou Camara");
});

test("le verrou survit au changement de rôle", () => {
  // Le cas qui motive `identityLockedAt` : sans lui, l'apprenant habilité
  // formateur récupérait la main sur le nom saisi par le centre.
  const promu = { role: "INSTRUCTOR" as const, identityLockedAt: new Date() };
  assert.equal(canUpdateProfileIdentity(promu), false);

  const update = buildProfileUpdate(promu, {
    firstName: "Nom",
    lastName: "Choisi",
    headline: "Formateur",
    bio: "",
    websiteUrl: "",
    linkedinUrl: "",
    facebookUrl: "",
    twitterUrl: "",
    youtubeUrl: "",
  });
  assert.equal("firstName" in update, false);
  assert.equal("lastName" in update, false);
  assert.equal("name" in update, false);
});

test("un compte sans verrou et hors rôle apprenant reste libre", () => {
  assert.equal(canUpdateProfileIdentity({ role: "INSTRUCTOR" }), true);
  assert.equal(
    canUpdateProfileIdentity({ role: "INSTRUCTOR", identityLockedAt: null }),
    true,
  );
  assert.equal(canUpdateProfileIdentity({ role: "STUDENT" }), false);
});

test("l'upload et l'association d'avatar appliquent le même refus serveur", async () => {
  const root = process.cwd();
  const [uploadRoute, profileAction] = await Promise.all([
    readFile(path.join(root, "src/app/api/upload/avatar/route.ts"), "utf8"),
    readFile(path.join(root, "src/server/actions/profile.ts"), "utf8"),
  ]);

  // Les deux chemins doivent lire le verrou EN BASE, pas dans le jeton : un
  // JWT émis avant le verrouillage porte encore l'ancien rôle.
  for (const source of [uploadRoute, profileAction]) {
    assert.match(source, /identityLockedAt: true/);
    assert.match(source, /!canUpdateProfileIdentity\(account\)/);
  }
  assert.match(uploadRoute, /status: 403/);
});

test("l'auto-promotion en formateur est refusée côté serveur", async () => {
  // Voie de contournement du verrou : se promouvoir formateur pour redevenir
  // maître de son identité. Le refus doit précéder toute autre logique.
  const source = await readFile(
    path.join(process.cwd(), "src/server/actions/instructor.ts"),
    "utf8",
  );
  const body = source.slice(source.indexOf("export async function becomeInstructor"));
  const guard = body.indexOf("isTrainingCenterMode()");
  const mutation = body.indexOf("prisma.user.update");
  assert.ok(guard > -1, "becomeInstructor doit vérifier le mode plateforme");
  assert.ok(guard < mutation, "le refus doit précéder la mutation de rôle");
});
