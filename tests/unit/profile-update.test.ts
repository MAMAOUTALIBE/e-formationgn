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
  const update = buildProfileUpdate("STUDENT", parsed);

  assert.equal("firstName" in update, false);
  assert.equal("lastName" in update, false);
  assert.equal("name" in update, false);
  assert.equal(update.headline, "Développeuse web");
  assert.equal(update.linkedinUrl, "https://www.linkedin.com/in/apprenante");
  assert.equal(update.facebookUrl, "https://www.facebook.com/apprenante");
  assert.equal(update.youtubeUrl, "https://www.youtube.com/@apprenante");
});

test("les autres rôles conservent la mise à jour de leur identité", () => {
  const update = buildProfileUpdate("INSTRUCTOR", {
    firstName: "Aïssatou",
    lastName: "Camara",
    headline: "Formatrice",
    bio: "",
    websiteUrl: "",
    linkedinUrl: "",
    facebookUrl: "",
    twitterUrl: "",
    youtubeUrl: "",
  });

  assert.equal(update.firstName, "Aïssatou");
  assert.equal(update.lastName, "Camara");
  assert.equal(update.name, "Aïssatou Camara");
});

test("l'upload et l'association d'avatar appliquent le même refus serveur", async () => {
  assert.equal(canUpdateProfileIdentity("STUDENT"), false);
  assert.equal(canUpdateProfileIdentity("INSTRUCTOR"), true);

  const root = process.cwd();
  const [uploadRoute, profileAction] = await Promise.all([
    readFile(path.join(root, "src/app/api/upload/avatar/route.ts"), "utf8"),
    readFile(path.join(root, "src/server/actions/profile.ts"), "utf8"),
  ]);

  assert.match(uploadRoute, /!canUpdateProfileIdentity\(session\.user\.role\)/);
  assert.match(uploadRoute, /status: 403/);
  assert.match(
    uploadRoute,
    /La photo de profil d’un apprenant ne peut pas être modifiée/,
  );
  assert.match(profileAction, /!canUpdateProfileIdentity\(session\.user\.role\)/);
});
