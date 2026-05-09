-- =============================================================================
-- 5_lesson_external_video — fallback URL .mp4 externe pour le player
-- Ajoute Lesson.externalVideoUrl : URL d'une vidéo MP4 externe (Blender CC,
-- contenu démo) utilisée par le player quand muxPlaybackId est absent.
-- =============================================================================

ALTER TABLE "Lesson"
  ADD COLUMN "externalVideoUrl" TEXT;
