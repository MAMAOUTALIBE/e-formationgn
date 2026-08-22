-- État civil des apprenants, saisi par l'administration.
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER');

ALTER TABLE "User"
  ADD COLUMN "birthDate"  DATE,
  ADD COLUMN "birthPlace" TEXT,
  ADD COLUMN "gender"     "Gender",
  ADD COLUMN "address"    TEXT;
