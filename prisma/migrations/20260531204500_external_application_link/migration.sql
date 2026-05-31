ALTER TYPE "ContactMethod" ADD VALUE 'EXTERNAL';

ALTER TABLE "Listing"
  ADD COLUMN "applicationUrl" TEXT;
