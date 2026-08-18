import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { canAnswerQuestion, canReadQuestion } from "../../src/lib/qa-access";

const privateQuestion = {
  visibility: "PRIVATE" as const,
  authorId: "student-1",
  instructorId: "instructor-1",
};

test("une question privée est invisible aux autres élèves et aux visiteurs", () => {
  assert.equal(canReadQuestion({ ...privateQuestion, viewerId: null }), false);
  assert.equal(canReadQuestion({ ...privateQuestion, viewerId: "student-2" }), false);
  assert.equal(
    canAnswerQuestion({ ...privateQuestion, viewerId: "student-2", isEnrolled: true }),
    false,
  );
});

test("auteur, formateur et admin peuvent lire une question privée", () => {
  assert.equal(canReadQuestion({ ...privateQuestion, viewerId: "student-1" }), true);
  assert.equal(canReadQuestion({ ...privateQuestion, viewerId: "instructor-1" }), true);
  assert.equal(
    canReadQuestion({ ...privateQuestion, viewerId: "admin", viewerRole: "ADMIN" }),
    true,
  );
});

test("une question publique est lisible mais seuls les inscrits autorisés répondent", () => {
  const publicQuestion = { ...privateQuestion, visibility: "PUBLIC" as const };
  assert.equal(canReadQuestion({ ...publicQuestion, viewerId: null }), true);
  assert.equal(
    canAnswerQuestion({ ...publicQuestion, viewerId: "student-2", isEnrolled: false }),
    false,
  );
  assert.equal(
    canAnswerQuestion({ ...publicQuestion, viewerId: "student-2", isEnrolled: true }),
    true,
  );
});

test("seul l’auteur, le formateur ou un admin répond à une question privée", () => {
  assert.equal(canAnswerQuestion({ ...privateQuestion, viewerId: "student-1" }), true);
  assert.equal(canAnswerQuestion({ ...privateQuestion, viewerId: "instructor-1" }), true);
  assert.equal(
    canAnswerQuestion({ ...privateQuestion, viewerId: "admin", viewerRole: "ADMIN" }),
    true,
  );
});

test("la réponse et sa notification officielle partagent une transaction", () => {
  const source = readFileSync(
    new URL("../../src/server/actions/qa.ts", import.meta.url),
    "utf8",
  );
  const answerAction = source.slice(
    source.indexOf("export async function answerQuestion"),
    source.indexOf("export async function setQuestionResolved"),
  );
  const transaction = answerAction.slice(answerAction.indexOf("prisma.$transaction"));

  assert.match(transaction, /tx\.answer\.create/);
  assert.match(transaction, /tx\.notification\.create/);
  assert.doesNotMatch(answerAction, /prisma\.answer\.create/);
  assert.doesNotMatch(answerAction, /prisma\.notification\.create/);
});
