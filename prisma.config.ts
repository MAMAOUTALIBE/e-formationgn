// Configuration Prisma — datasource pilotée par .env.
//
// En prod multi-instance (Vercel, Fly), DATABASE_URL pointe sur PgBouncer
// (mode `transaction`, port 6543 sur Supabase). Mais les migrations Prisma
// requièrent une connexion directe (DDL transactionnel + prepared statements
// non supportés en mode transaction). DIRECT_URL contourne pgbouncer
// (port 5432) et n'est utilisée QUE par `prisma migrate` et `prisma db push`.
// Fallback sur DATABASE_URL si non posée (dev / single-instance).

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
