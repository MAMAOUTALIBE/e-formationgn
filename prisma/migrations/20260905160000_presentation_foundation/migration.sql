-- Socle des leçons PowerPoint privées et interactives.
ALTER TYPE "LessonType" ADD VALUE IF NOT EXISTS 'PRESENTATION';

CREATE TYPE "PresentationStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'ERROR');
CREATE TYPE "PresentationHotspotKind" AS ENUM ('EXTERNAL_URL', 'INTERNAL_SLIDE');

CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "sourceContentType" TEXT NOT NULL,
    "sourceSizeBytes" INTEGER NOT NULL,
    "status" "PresentationStatus" NOT NULL DEFAULT 'UPLOADED',
    "slideCount" INTEGER NOT NULL DEFAULT 0,
    "compatibilityReport" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Presentation_source_size_check" CHECK ("sourceSizeBytes" > 0),
    CONSTRAINT "Presentation_slide_count_check" CHECK ("slideCount" >= 0)
);

CREATE TABLE "PresentationSlide" (
    "id" TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "imageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PresentationSlide_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PresentationSlide_dimensions_check" CHECK ("width" > 0 AND "height" > 0),
    CONSTRAINT "PresentationSlide_order_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "PresentationHotspot" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "kind" "PresentationHotspotKind" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "externalUrl" TEXT,
    "targetSlideOrder" INTEGER,
    "ariaLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PresentationHotspot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PresentationHotspot_bounds_check" CHECK (
      "x" >= 0 AND "y" >= 0 AND "width" > 0 AND "height" > 0
      AND "x" + "width" <= 1 AND "y" + "height" <= 1
    ),
    CONSTRAINT "PresentationHotspot_destination_check" CHECK (
      ("kind" = 'EXTERNAL_URL' AND "externalUrl" IS NOT NULL AND "targetSlideOrder" IS NULL)
      OR
      ("kind" = 'INTERNAL_SLIDE' AND "externalUrl" IS NULL AND "targetSlideOrder" >= 0)
    )
);

CREATE TABLE "PresentationProgress" (
    "id" TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSlideOrder" INTEGER NOT NULL DEFAULT 0,
    "viewedSlideOrders" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "PresentationProgress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PresentationProgress_last_slide_check" CHECK ("lastSlideOrder" >= 0)
);

CREATE UNIQUE INDEX "Presentation_lessonId_key" ON "Presentation"("lessonId");
CREATE INDEX "Presentation_status_updatedAt_idx" ON "Presentation"("status", "updatedAt");
CREATE UNIQUE INDEX "PresentationSlide_presentationId_displayOrder_key" ON "PresentationSlide"("presentationId", "displayOrder");
CREATE INDEX "PresentationSlide_presentationId_idx" ON "PresentationSlide"("presentationId");
CREATE INDEX "PresentationHotspot_slideId_idx" ON "PresentationHotspot"("slideId");
CREATE UNIQUE INDEX "PresentationProgress_presentationId_userId_key" ON "PresentationProgress"("presentationId", "userId");
CREATE INDEX "PresentationProgress_userId_lastViewedAt_idx" ON "PresentationProgress"("userId", "lastViewedAt");

ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresentationSlide" ADD CONSTRAINT "PresentationSlide_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "Presentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresentationHotspot" ADD CONSTRAINT "PresentationHotspot_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "PresentationSlide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresentationProgress" ADD CONSTRAINT "PresentationProgress_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "Presentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresentationProgress" ADD CONSTRAINT "PresentationProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
