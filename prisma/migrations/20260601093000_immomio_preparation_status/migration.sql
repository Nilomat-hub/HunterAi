ALTER TYPE "Portal" ADD VALUE 'IMMOMIO';

ALTER TYPE "ApplicationStatus" ADD VALUE 'PREPARING';
ALTER TYPE "ApplicationStatus" ADD VALUE 'READY_TO_SUBMIT';

ALTER TABLE "Application"
  ADD COLUMN "externalStatus" TEXT,
  ADD COLUMN "externalPayload" JSONB,
  ADD COLUMN "lastPreparedAt" TIMESTAMP(3);
