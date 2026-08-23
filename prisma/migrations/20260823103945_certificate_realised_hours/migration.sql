-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "completedSeconds" INTEGER,
ADD COLUMN     "registrationId" TEXT;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
