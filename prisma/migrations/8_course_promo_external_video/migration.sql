-- =============================================================================
-- 8_course_promo_external_video — fallback URL .mp4 pour la vidéo de promo
-- Ajoute Course.promoVideoUrl : URL d'un MP4 externe (ex: /demo/videotest.mp4
-- ou Cloudinary/S3) utilisée par le PromoVideoPlayer quand
-- promoVideoPlaybackId (Mux) est absent.
-- =============================================================================

ALTER TABLE "Course"
  ADD COLUMN "promoVideoUrl" TEXT;
