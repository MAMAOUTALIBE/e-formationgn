-- CreateEnum
CREATE TYPE "AssistantMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AssistantCertainty" AS ENUM ('CERTAINE', 'PARTIELLE', 'INCONNUE');

-- CreateEnum
CREATE TYPE "AssistantLeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CLOSED');

-- CreateTable
CREATE TABLE "AssistantDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "sourceUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "searchVector" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantConversation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AssistantMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "certainty" "AssistantCertainty",
    "answered" BOOLEAN NOT NULL DEFAULT true,
    "sources" JSONB,
    "courseSlugs" TEXT[],
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantLead" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "courseId" TEXT,
    "status" "AssistantLeadStatus" NOT NULL DEFAULT 'NEW',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "internalNote" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantDocument_slug_key" ON "AssistantDocument"("slug");

-- CreateIndex
CREATE INDEX "AssistantDocument_isPublished_idx" ON "AssistantDocument"("isPublished");

-- CreateIndex
CREATE INDEX "AssistantDocument_category_idx" ON "AssistantDocument"("category");

-- CreateIndex
CREATE INDEX "AssistantChunk_documentId_idx" ON "AssistantChunk"("documentId");

-- CreateIndex
CREATE INDEX "AssistantChunk_searchVector_idx" ON "AssistantChunk" USING GIN ("searchVector" tsvector_ops);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConversation_publicId_key" ON "AssistantConversation"("publicId");

-- CreateIndex
CREATE INDEX "AssistantConversation_userId_idx" ON "AssistantConversation"("userId");

-- CreateIndex
CREATE INDEX "AssistantConversation_lastMessageAt_idx" ON "AssistantConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "AssistantConversation_escalated_idx" ON "AssistantConversation"("escalated");

-- CreateIndex
CREATE INDEX "AssistantMessage_conversationId_createdAt_idx" ON "AssistantMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_answered_idx" ON "AssistantMessage"("answered");

-- CreateIndex
CREATE INDEX "AssistantMessage_createdAt_idx" ON "AssistantMessage"("createdAt");

-- CreateIndex
CREATE INDEX "AssistantLead_status_idx" ON "AssistantLead"("status");

-- CreateIndex
CREATE INDEX "AssistantLead_createdAt_idx" ON "AssistantLead"("createdAt");

-- CreateIndex
CREATE INDEX "AssistantLead_courseId_idx" ON "AssistantLead"("courseId");

-- AddForeignKey
ALTER TABLE "AssistantDocument" ADD CONSTRAINT "AssistantDocument_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantChunk" ADD CONSTRAINT "AssistantChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AssistantDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantLead" ADD CONSTRAINT "AssistantLead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantLead" ADD CONSTRAINT "AssistantLead_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantLead" ADD CONSTRAINT "AssistantLead_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Recherche plein-texte française sur les fragments de la base documentaire.
--
-- Même approche que prisma/migrations/1_course_search : colonne `searchVector`
-- peuplée par un trigger BEFORE INSERT/UPDATE. Une colonne générée ne
-- fonctionne pas ici car to_tsvector('french', ...) n'est pas IMMUTABLE.
--
-- Pondération : heading=A (le titre de section porte l'intention de la
-- question), content=B. L'index GIN est déjà créé plus haut par Prisma à
-- partir de `@@index([searchVector(ops: raw("tsvector_ops"))], type: Gin)`.
--
-- Idempotent (CREATE OR REPLACE + DROP IF EXISTS) : rejouable sans risque.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION assistant_chunk_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('french', coalesce(NEW."heading", '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW."content", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assistant_chunk_search_vector_trigger ON "AssistantChunk";
CREATE TRIGGER assistant_chunk_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "heading", "content"
  ON "AssistantChunk"
  FOR EACH ROW
  EXECUTE FUNCTION assistant_chunk_search_vector_update();
