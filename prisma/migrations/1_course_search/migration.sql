-- Recherche full-text Postgres sur les cours.
--
-- Approche : colonne `searchVector` mise à jour par trigger BEFORE
-- INSERT/UPDATE. (Les colonnes générées ne fonctionnent pas avec
-- to_tsvector('french', ...) car elle n'est pas marquée IMMUTABLE.)
--
-- Pondération : title=A, subtitle=B, description=C, listes=D.
-- Index GIN pour des recherches O(log N).
-- Idempotent (DROP IF EXISTS + CREATE) — peut être rejoué.

-- 1) Colonne (nullable, remplie par le trigger)
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- 2) Fonction qui calcule le tsvector à partir de NEW.*
CREATE OR REPLACE FUNCTION course_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('french', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW."subtitle", '')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW."description", '')), 'C') ||
    setweight(to_tsvector('french',
      coalesce(array_to_string(NEW."whatYouWillLearn", ' '), '')), 'D') ||
    setweight(to_tsvector('french',
      coalesce(array_to_string(NEW."targetAudience", ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS course_search_vector_trigger ON "Course";
CREATE TRIGGER course_search_vector_trigger
  BEFORE INSERT OR UPDATE OF
    "title", "subtitle", "description", "whatYouWillLearn", "targetAudience"
  ON "Course"
  FOR EACH ROW
  EXECUTE FUNCTION course_search_vector_update();

-- 4) Backfill des cours existants (UPDATE sans changer les valeurs déclenche
--    le trigger, qui peuple searchVector). On force via SET title=title.
UPDATE "Course" SET "title" = "title";

-- 5) Index GIN
CREATE INDEX IF NOT EXISTS "Course_searchVector_idx"
  ON "Course" USING GIN ("searchVector");
