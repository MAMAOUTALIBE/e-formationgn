ALTER TYPE "NotificationKind" ADD VALUE 'VIRTUAL_CLASS_SCHEDULED';
ALTER TYPE "NotificationKind" ADD VALUE 'VIRTUAL_CLASS_UPDATED';
ALTER TYPE "NotificationKind" ADD VALUE 'VIRTUAL_CLASS_CANCELLED';
ALTER TYPE "NotificationKind" ADD VALUE 'VIRTUAL_CLASS_REMINDER';
ALTER TYPE "NotificationKind" ADD VALUE 'VIRTUAL_CLASS_REPLAY_AVAILABLE';

ALTER TYPE "WebhookSource" ADD VALUE 'LIVEKIT';

CREATE TYPE "VirtualClassStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'LIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "VirtualClassAttendanceRole" AS ENUM ('ADMIN', 'INSTRUCTOR', 'STUDENT');
CREATE TYPE "VirtualClassAttendanceStatus" AS ENUM ('EXPECTED', 'PRESENT', 'PARTIAL', 'ABSENT', 'EXCUSED');
CREATE TYPE "VirtualClassMessageType" AS ENUM ('MESSAGE', 'QUESTION');
CREATE TYPE "VirtualClassResourceVisibility" AS ENUM ('BEFORE', 'DURING', 'AFTER', 'ALWAYS');
CREATE TYPE "VirtualClassRecordingStatus" AS ENUM ('STARTING', 'ACTIVE', 'PROCESSING', 'READY', 'FAILED', 'STOPPED');
CREATE TYPE "VirtualClassNotificationKind" AS ENUM ('CONFIRMATION', 'UPDATED', 'CANCELLED', 'REMINDER_24H', 'REMINDER_1H', 'REMINDER_15M', 'REPLAY_AVAILABLE');

CREATE TABLE "VirtualClassSession" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "agenda" TEXT,
  "trainingSessionId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "scheduledEndAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
  "maxParticipants" INTEGER,
  "livekitRoomName" TEXT NOT NULL,
  "status" "VirtualClassStatus" NOT NULL DEFAULT 'DRAFT',
  "recordingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "earlyJoinMinutes" INTEGER NOT NULL DEFAULT 15,
  "openedAt" TIMESTAMP(3),
  "liveStartedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualClassSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VirtualClassAttendance" (
  "id" TEXT NOT NULL,
  "virtualClassId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "VirtualClassAttendanceRole" NOT NULL,
  "firstJoinedAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3),
  "lastLeftAt" TIMESTAMP(3),
  "totalSeconds" INTEGER NOT NULL DEFAULT 0,
  "connectionCount" INTEGER NOT NULL DEFAULT 0,
  "status" "VirtualClassAttendanceStatus" NOT NULL DEFAULT 'EXPECTED',
  "confirmed" BOOLEAN NOT NULL DEFAULT false,
  "deviceInfo" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualClassAttendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VirtualClassConnectionPeriod" (
  "id" TEXT NOT NULL,
  "attendanceId" TEXT NOT NULL,
  "participantSid" TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL,
  "leftAt" TIMESTAMP(3),
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "closeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VirtualClassConnectionPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VirtualClassMessage" (
  "id" TEXT NOT NULL,
  "virtualClassId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "type" "VirtualClassMessageType" NOT NULL DEFAULT 'MESSAGE',
  "content" TEXT NOT NULL,
  "response" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "moderatedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "visibleAfterClass" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VirtualClassMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VirtualClassResource" (
  "id" TEXT NOT NULL,
  "virtualClassId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "storageUrl" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "fileSizeBytes" INTEGER,
  "authorId" TEXT NOT NULL,
  "visibility" "VirtualClassResourceVisibility" NOT NULL DEFAULT 'ALWAYS',
  "downloadable" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VirtualClassResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VirtualClassRecording" (
  "id" TEXT NOT NULL,
  "virtualClassId" TEXT NOT NULL,
  "egressId" TEXT NOT NULL,
  "status" "VirtualClassRecordingStatus" NOT NULL DEFAULT 'STARTING',
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "storageKey" TEXT,
  "muxAssetId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "visible" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3),
  "technicalError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualClassRecording_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VirtualClassNotificationDelivery" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "virtualClassId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "VirtualClassNotificationKind" NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VirtualClassNotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VirtualClassSession_livekitRoomName_key" ON "VirtualClassSession"("livekitRoomName");
CREATE INDEX "VirtualClassSession_trainingSessionId_startsAt_idx" ON "VirtualClassSession"("trainingSessionId", "startsAt");
CREATE INDEX "VirtualClassSession_instructorId_startsAt_idx" ON "VirtualClassSession"("instructorId", "startsAt");
CREATE INDEX "VirtualClassSession_status_startsAt_idx" ON "VirtualClassSession"("status", "startsAt");
CREATE UNIQUE INDEX "VirtualClassAttendance_virtualClassId_userId_key" ON "VirtualClassAttendance"("virtualClassId", "userId");
CREATE INDEX "VirtualClassAttendance_userId_status_idx" ON "VirtualClassAttendance"("userId", "status");
CREATE INDEX "VirtualClassAttendance_virtualClassId_status_idx" ON "VirtualClassAttendance"("virtualClassId", "status");
CREATE INDEX "VirtualClassConnectionPeriod_attendanceId_joinedAt_idx" ON "VirtualClassConnectionPeriod"("attendanceId", "joinedAt");
CREATE INDEX "VirtualClassConnectionPeriod_participantSid_idx" ON "VirtualClassConnectionPeriod"("participantSid");
CREATE INDEX "VirtualClassMessage_virtualClassId_createdAt_idx" ON "VirtualClassMessage"("virtualClassId", "createdAt");
CREATE INDEX "VirtualClassMessage_authorId_idx" ON "VirtualClassMessage"("authorId");
CREATE INDEX "VirtualClassResource_virtualClassId_publishedAt_idx" ON "VirtualClassResource"("virtualClassId", "publishedAt");
CREATE UNIQUE INDEX "VirtualClassRecording_egressId_key" ON "VirtualClassRecording"("egressId");
CREATE INDEX "VirtualClassRecording_virtualClassId_status_idx" ON "VirtualClassRecording"("virtualClassId", "status");
CREATE UNIQUE INDEX "VirtualClassNotificationDelivery_idempotencyKey_key" ON "VirtualClassNotificationDelivery"("idempotencyKey");
CREATE INDEX "VirtualClassNotificationDelivery_virtualClassId_kind_idx" ON "VirtualClassNotificationDelivery"("virtualClassId", "kind");
CREATE INDEX "VirtualClassNotificationDelivery_userId_sentAt_idx" ON "VirtualClassNotificationDelivery"("userId", "sentAt");

ALTER TABLE "VirtualClassSession" ADD CONSTRAINT "VirtualClassSession_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VirtualClassSession" ADD CONSTRAINT "VirtualClassSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VirtualClassSession" ADD CONSTRAINT "VirtualClassSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VirtualClassAttendance" ADD CONSTRAINT "VirtualClassAttendance_virtualClassId_fkey" FOREIGN KEY ("virtualClassId") REFERENCES "VirtualClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassAttendance" ADD CONSTRAINT "VirtualClassAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassConnectionPeriod" ADD CONSTRAINT "VirtualClassConnectionPeriod_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "VirtualClassAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassMessage" ADD CONSTRAINT "VirtualClassMessage_virtualClassId_fkey" FOREIGN KEY ("virtualClassId") REFERENCES "VirtualClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassMessage" ADD CONSTRAINT "VirtualClassMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassResource" ADD CONSTRAINT "VirtualClassResource_virtualClassId_fkey" FOREIGN KEY ("virtualClassId") REFERENCES "VirtualClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassResource" ADD CONSTRAINT "VirtualClassResource_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VirtualClassRecording" ADD CONSTRAINT "VirtualClassRecording_virtualClassId_fkey" FOREIGN KEY ("virtualClassId") REFERENCES "VirtualClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassRecording" ADD CONSTRAINT "VirtualClassRecording_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VirtualClassNotificationDelivery" ADD CONSTRAINT "VirtualClassNotificationDelivery_virtualClassId_fkey" FOREIGN KEY ("virtualClassId") REFERENCES "VirtualClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualClassNotificationDelivery" ADD CONSTRAINT "VirtualClassNotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
