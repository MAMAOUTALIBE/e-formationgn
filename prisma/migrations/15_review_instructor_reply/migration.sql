-- Réponse publique du formateur sur les avis — pattern Udemy "Instructor reply".

ALTER TABLE "Review"
  ADD COLUMN "instructorReply"     TEXT,
  ADD COLUMN "instructorRepliedAt" TIMESTAMP(3);
