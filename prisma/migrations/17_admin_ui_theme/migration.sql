-- Couleurs de la coquille du CRM admin (barre latérale, header, footer).
-- Table à ligne unique ("singleton") : voir prisma/schema.prisma.
-- Colonnes nullables = « garder la couleur par défaut de la charte ».
CREATE TABLE IF NOT EXISTS "AdminUiTheme" (
    "id"        TEXT NOT NULL DEFAULT 'singleton',
    "sidebarBg" TEXT,
    "headerBg"  TEXT,
    "footerBg"  TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AdminUiTheme_pkey" PRIMARY KEY ("id")
);
