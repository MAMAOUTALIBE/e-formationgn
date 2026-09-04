-- Indexation du titre du document dans chaque fragment.
--
-- Constat à l'usage : un document dont le corps porte ses propres titres de
-- section n'avait jamais son propre titre dans l'index. Le document intitulé
-- « Comment s'inscrire à une formation Aiduca » ne remontait donc pas sur la
-- requête « comment s'inscrire » — le stemmer français produit `inscrir` pour
-- « inscrire » et `inscript` pour « inscription », deux lexèmes distincts, et
-- seul le corps (qui dit « inscription ») était indexé.
--
-- Le titre est dénormalisé sur le fragment : les fragments sont régénérés en
-- bloc à chaque sauvegarde du document, la valeur ne peut donc pas dériver.

-- 1) Colonne, d'abord permissive pour permettre le remplissage.
ALTER TABLE "AssistantChunk" ADD COLUMN IF NOT EXISTS "documentTitle" TEXT;

-- 2) Remplissage depuis le document parent.
UPDATE "AssistantChunk" c
SET "documentTitle" = d."title"
FROM "AssistantDocument" d
WHERE d."id" = c."documentId" AND c."documentTitle" IS NULL;

-- 3) Contrainte définitive.
ALTER TABLE "AssistantChunk" ALTER COLUMN "documentTitle" SET NOT NULL;

-- 4) Le trigger prend le titre en compte.
--    Pondération : documentTitle et heading en A (ce sont les porteurs
--    d'intention), content en B.
CREATE OR REPLACE FUNCTION assistant_chunk_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('french', coalesce(NEW."documentTitle", '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW."heading", '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW."content", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assistant_chunk_search_vector_trigger ON "AssistantChunk";
CREATE TRIGGER assistant_chunk_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "documentTitle", "heading", "content"
  ON "AssistantChunk"
  FOR EACH ROW
  EXECUTE FUNCTION assistant_chunk_search_vector_update();

-- 5) Réindexation des fragments existants (l'UPDATE déclenche le trigger).
UPDATE "AssistantChunk" SET "documentTitle" = "documentTitle";
