-- Audit log hash chain : chaque entrée hashe la précédente + son contenu.
-- Toute altération a posteriori casse la chaîne (détectable au scan).

ALTER TABLE "AuditLog"
  ADD COLUMN "previousHash" CHAR(64),
  ADD COLUMN "hash"         CHAR(64);
