-- =============================================================================
-- 3_admin_crm — CRM administrateur complet
-- Sous-rôles, métadonnées User/Course, Analytics, Support, Modération,
-- Marketing (campagnes email), Sécurité (RGPD, impersonation, IPs bannies).
-- =============================================================================

-- --- Enums étendus ----------------------------------------------------------

ALTER TYPE "UserRole" ADD VALUE 'MODERATOR';
ALTER TYPE "UserRole" ADD VALUE 'SUPPORT';
ALTER TYPE "UserRole" ADD VALUE 'FINANCE';

-- --- Métadonnées User -------------------------------------------------------

ALTER TABLE "User"
  ADD COLUMN "country" TEXT,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "bannedAt" TIMESTAMP(3),
  ADD COLUMN "bannedReason" TEXT,
  ADD COLUMN "internalNotes" TEXT;

-- --- Curation Course --------------------------------------------------------

ALTER TABLE "Course"
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "featuredOrder" INTEGER,
  ADD COLUMN "internalNotes" TEXT;

CREATE INDEX "Course_isFeatured_featuredOrder_idx"
  ON "Course"("isFeatured", "featuredOrder");

-- --- Nouveaux enums ---------------------------------------------------------

CREATE TYPE "TicketStatus" AS ENUM (
  'OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'
);

CREATE TYPE "TicketPriority" AS ENUM (
  'LOW', 'NORMAL', 'HIGH', 'URGENT'
);

CREATE TYPE "TicketCategory" AS ENUM (
  'TECHNICAL', 'BILLING', 'CONTENT', 'ACCOUNT', 'OTHER'
);

CREATE TYPE "DisputeStatus" AS ENUM (
  'OPEN', 'IN_REVIEW', 'RESOLVED_REFUND', 'RESOLVED_NO_REFUND', 'ESCALATED'
);

CREATE TYPE "ReportTargetType" AS ENUM (
  'REVIEW', 'QUESTION', 'ANSWER', 'USER', 'COURSE'
);

CREATE TYPE "ReportReason" AS ENUM (
  'SPAM', 'HARASSMENT', 'COPYRIGHT', 'INAPPROPRIATE', 'OTHER'
);

CREATE TYPE "ReportStatus" AS ENUM (
  'PENDING', 'REVIEWING', 'RESOLVED_HIDDEN', 'RESOLVED_DELETED', 'DISMISSED'
);

CREATE TYPE "ModerationRuleKind" AS ENUM ('KEYWORD', 'REGEX');
CREATE TYPE "ModerationRuleAction" AS ENUM ('FLAG', 'HIDE', 'BLOCK');

CREATE TYPE "GdprRequestKind" AS ENUM ('EXPORT', 'DELETE');
CREATE TYPE "GdprRequestStatus" AS ENUM (
  'PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'
);

CREATE TYPE "EmailCampaignStatus" AS ENUM (
  'DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELED', 'FAILED'
);

CREATE TYPE "BannerKind" AS ENUM ('INFO', 'PROMO', 'WARNING');

CREATE TYPE "AdminNoteTargetType" AS ENUM (
  'USER', 'COURSE', 'ORDER', 'TICKET'
);

-- --- Analytics : PageView ---------------------------------------------------

CREATE TABLE "PageView" (
  "id"          TEXT NOT NULL,
  "path"        TEXT NOT NULL,
  "userId"      TEXT,
  "sessionId"   TEXT NOT NULL,
  "referrer"    TEXT,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "country"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PageView_path_createdAt_idx" ON "PageView"("path", "createdAt");
CREATE INDEX "PageView_userId_idx" ON "PageView"("userId");
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

-- --- Support : SupportTicket + TicketMessage --------------------------------

CREATE TABLE "SupportTicket" (
  "id"          TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "status"      "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority"    "TicketPriority" NOT NULL DEFAULT 'NORMAL',
  "category"    "TicketCategory" NOT NULL DEFAULT 'OTHER',
  "requesterId" TEXT NOT NULL,
  "assigneeId"  TEXT,
  "slaDueAt"    TIMESTAMP(3),
  "closedAt"    TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");
CREATE INDEX "SupportTicket_requesterId_idx" ON "SupportTicket"("requesterId");
CREATE INDEX "SupportTicket_assigneeId_idx" ON "SupportTicket"("assigneeId");
ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TicketMessage" (
  "id"             TEXT NOT NULL,
  "ticketId"       TEXT NOT NULL,
  "authorId"       TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
  "attachments"    JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");
ALTER TABLE "TicketMessage"
  ADD CONSTRAINT "TicketMessage_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketMessage"
  ADD CONSTRAINT "TicketMessage_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- Litiges : Dispute ------------------------------------------------------

CREATE TABLE "Dispute" (
  "id"         TEXT NOT NULL,
  "orderId"    TEXT NOT NULL,
  "reason"     TEXT NOT NULL,
  "status"     "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- --- Modération : Report + ModerationRule -----------------------------------

CREATE TABLE "Report" (
  "id"          TEXT NOT NULL,
  "reporterId"  TEXT NOT NULL,
  "targetType"  "ReportTargetType" NOT NULL,
  "targetId"    TEXT NOT NULL,
  "reason"      "ReportReason" NOT NULL,
  "description" TEXT,
  "status"      "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedAt"  TIMESTAMP(3),
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE INDEX "Report_status_idx" ON "Report"("status");
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ModerationRule" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "kind"      "ModerationRuleKind" NOT NULL DEFAULT 'KEYWORD',
  "pattern"   TEXT NOT NULL,
  "action"    "ModerationRuleAction" NOT NULL DEFAULT 'FLAG',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModerationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModerationRule_isActive_idx" ON "ModerationRule"("isActive");

-- --- Sécurité : LoginAttempt + BannedIP + GdprRequest + ImpersonationSession

CREATE TABLE "LoginAttempt" (
  "id"        TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "userId"    TEXT,
  "ipHash"    TEXT NOT NULL,
  "userAgent" TEXT,
  "success"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");
CREATE INDEX "LoginAttempt_ipHash_createdAt_idx" ON "LoginAttempt"("ipHash", "createdAt");
ALTER TABLE "LoginAttempt"
  ADD CONSTRAINT "LoginAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BannedIP" (
  "id"          TEXT NOT NULL,
  "ipHash"      TEXT NOT NULL,
  "reason"      TEXT,
  "bannedById"  TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BannedIP_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BannedIP_ipHash_key" ON "BannedIP"("ipHash");
ALTER TABLE "BannedIP"
  ADD CONSTRAINT "BannedIP_bannedById_fkey"
  FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GdprRequest" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "kind"        "GdprRequestKind" NOT NULL,
  "status"      "GdprRequestStatus" NOT NULL DEFAULT 'PENDING',
  "metadata"    JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "GdprRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GdprRequest_userId_idx" ON "GdprRequest"("userId");
CREATE INDEX "GdprRequest_status_idx" ON "GdprRequest"("status");
ALTER TABLE "GdprRequest"
  ADD CONSTRAINT "GdprRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ImpersonationSession" (
  "id"           TEXT NOT NULL,
  "adminId"      TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "reason"       TEXT,
  "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"      TIMESTAMP(3),
  CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ImpersonationSession_adminId_idx" ON "ImpersonationSession"("adminId");
CREATE INDEX "ImpersonationSession_targetUserId_idx" ON "ImpersonationSession"("targetUserId");
ALTER TABLE "ImpersonationSession"
  ADD CONSTRAINT "ImpersonationSession_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImpersonationSession"
  ADD CONSTRAINT "ImpersonationSession_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- Marketing : EmailTemplate + EmailCampaign + Recipient + UserSegment + Banner

CREATE TABLE "EmailTemplate" (
  "id"        TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "subject"   TEXT NOT NULL,
  "bodyHtml"  TEXT NOT NULL,
  "bodyText"  TEXT NOT NULL,
  "variables" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailTemplate_slug_key" ON "EmailTemplate"("slug");

CREATE TABLE "EmailCampaign" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "templateId"        TEXT NOT NULL,
  "segmentDefinition" JSONB NOT NULL,
  "status"            "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledFor"      TIMESTAMP(3),
  "sentAt"            TIMESTAMP(3),
  "totalRecipients"   INTEGER NOT NULL DEFAULT 0,
  "totalDelivered"    INTEGER NOT NULL DEFAULT 0,
  "totalOpened"       INTEGER NOT NULL DEFAULT 0,
  "totalClicked"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailCampaign_status_idx" ON "EmailCampaign"("status");
CREATE INDEX "EmailCampaign_scheduledFor_idx" ON "EmailCampaign"("scheduledFor");
ALTER TABLE "EmailCampaign"
  ADD CONSTRAINT "EmailCampaign_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EmailCampaignRecipient" (
  "id"         TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "sentAt"     TIMESTAMP(3),
  "openedAt"   TIMESTAMP(3),
  "clickedAt"  TIMESTAMP(3),
  "bouncedAt"  TIMESTAMP(3),
  CONSTRAINT "EmailCampaignRecipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailCampaignRecipient_campaignId_userId_key"
  ON "EmailCampaignRecipient"("campaignId", "userId");
CREATE INDEX "EmailCampaignRecipient_userId_idx" ON "EmailCampaignRecipient"("userId");
ALTER TABLE "EmailCampaignRecipient"
  ADD CONSTRAINT "EmailCampaignRecipient_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailCampaignRecipient"
  ADD CONSTRAINT "EmailCampaignRecipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserSegment" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "definition"  JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSegment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "UserSegment"
  ADD CONSTRAINT "UserSegment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SitewideBanner" (
  "id"        TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "ctaLabel"  TEXT,
  "ctaUrl"    TEXT,
  "kind"      "BannerKind" NOT NULL DEFAULT 'INFO',
  "startsAt"  TIMESTAMP(3),
  "endsAt"    TIMESTAMP(3),
  "isActive"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SitewideBanner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SitewideBanner_isActive_startsAt_endsAt_idx"
  ON "SitewideBanner"("isActive", "startsAt", "endsAt");

-- --- Notes admin polymorphes ------------------------------------------------

CREATE TABLE "AdminNote" (
  "id"         TEXT NOT NULL,
  "targetType" "AdminNoteTargetType" NOT NULL,
  "targetId"   TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "authorId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminNote_targetType_targetId_idx" ON "AdminNote"("targetType", "targetId");
ALTER TABLE "AdminNote"
  ADD CONSTRAINT "AdminNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
