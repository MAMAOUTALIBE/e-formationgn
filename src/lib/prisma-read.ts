// Client Prisma routé vers une read replica si DATABASE_READ_URL est définie,
// sinon fallback vers le client primaire (= aucune différence en dev).
//
// Pattern d'usage : importer `prismaRead` au lieu de `prisma` POUR LES QUERIES
// PUBLIQUES EN LECTURE PURE (catalogue, page cours, page formateur, recherche).
// Ne JAMAIS utiliser pour :
//   - une lecture suivie d'un write dans la même requête (risque de read-after-write
//     lag : la replica n'a pas encore les données du master qu'on vient d'écrire)
//   - une lecture critique de cohérence (panier, checkout, dashboard utilisateur)
//   - les transactions (le replica est read-only)
//
// La replica peut accuser jusqu'à quelques secondes de retard selon Supabase /
// AWS RDS. Pour un site catalogue (cours, catégories, reviews) c'est invisible
// pour l'utilisateur ; pour le checkout / dashboard, c'est inacceptable.
//
// Configuration prod recommandée (Supabase) :
//   DATABASE_URL        → pooler primary (6543, pgbouncer)
//   DATABASE_READ_URL   → pooler read replica (6543, pgbouncer)
//   DIRECT_URL          → primary direct (5432, pour migrations)

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __prismaReadClient: PrismaClient | undefined;
}

function createReadClient(): PrismaClient {
  // Si DATABASE_READ_URL n'est pas posée, on retombe sur DATABASE_URL
  // → comportement identique au client primaire (pas de risque en dev).
  const connectionString =
    process.env.DATABASE_READ_URL ??
    process.env.DATABASE_URL ??
    "postgresql://placeholder@localhost:5432/placeholder";

  const adapter = new PrismaPg(connectionString);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prismaRead: PrismaClient =
  globalThis.__prismaReadClient ?? createReadClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaReadClient = prismaRead;
}

export function isReadReplicaConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_READ_URL &&
      process.env.DATABASE_READ_URL !== process.env.DATABASE_URL,
  );
}
