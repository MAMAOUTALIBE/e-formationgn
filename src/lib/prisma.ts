// Singleton Prisma Client — évite la multiplication de connexions en dev
// (chaque hot-reload de Next.js réinstancierait sinon un nouveau client).
//
// Note Prisma 7 :
// - Le client est généré dans `src/generated/prisma` (cf. schema.prisma).
// - Un driver adapter (`@prisma/adapter-pg`) est requis pour fournir la
//   connexion Postgres ; l'URL est lue depuis DATABASE_URL.

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __prismaClient: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  // `||` et non `??` : une DATABASE_URL vide (chaîne non nullish) serait passée
  // telle quelle à PrismaPg, qui retomberait silencieusement sur les défauts
  // libpq (localhost:5432) au lieu d'échouer visiblement.
  const connectionString =
    process.env.DATABASE_URL || "postgresql://placeholder@localhost:5432/placeholder";

  const adapter = new PrismaPg(connectionString);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient = globalThis.__prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}
