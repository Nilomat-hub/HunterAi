CREATE TYPE "Portal" AS ENUM ('IMMOSCOUT24', 'IMMOWELT', 'IMMONET', 'MEINESTADT', 'IMMOBILIE1');
CREATE TYPE "ListingStatus" AS ENUM ('NEW', 'NOTIFIED', 'IGNORED', 'DUPLICATE', 'APPLIED', 'ERROR');
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'FAILED', 'IGNORED');
CREATE TYPE "ContactMethod" AS ENUM ('FORM', 'EMAIL');
CREATE TYPE "TelegramLogType" AS ENUM ('LISTING_FOUND', 'APPLICATION_SENT', 'REPLY_RECEIVED', 'ERROR', 'ACTION');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "age" INTEGER,
  "occupation" TEXT,
  "employer" TEXT,
  "netIncome" INTEGER,
  "householdSize" INTEGER,
  "pets" TEXT,
  "moveInDate" TIMESTAMP(3),
  "personalBio" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "districts" TEXT[],
  "maxPrice" INTEGER NOT NULL,
  "minSize" INTEGER NOT NULL,
  "rooms" DOUBLE PRECISION NOT NULL,
  "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
  "keywords" TEXT[],
  "excludedWords" TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SearchProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "portal" "Portal" NOT NULL,
  "usernameEncrypted" TEXT NOT NULL,
  "passwordEncrypted" TEXT NOT NULL,
  "cookiesEncrypted" TEXT,
  "sessionDataEncrypted" TEXT,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortalAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Listing" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "searchProfileId" TEXT,
  "portal" "Portal" NOT NULL,
  "url" TEXT NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "price" INTEGER,
  "size" DOUBLE PRECISION,
  "rooms" DOUBLE PRECISION,
  "address" TEXT,
  "district" TEXT,
  "provider" TEXT,
  "images" TEXT[],
  "description" TEXT,
  "publishedAt" TIMESTAMP(3),
  "score" INTEGER NOT NULL DEFAULT 0,
  "scoreLabel" TEXT NOT NULL DEFAULT 'Niedrige Priorität',
  "duplicateOfId" TEXT,
  "status" "ListingStatus" NOT NULL DEFAULT 'NEW',
  "contactMethod" "ContactMethod" NOT NULL DEFAULT 'FORM',
  "contactEmail" TEXT,
  "rawData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Application" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "message" TEXT NOT NULL,
  "editedMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "listingId" TEXT,
  "direction" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "from" TEXT,
  "to" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "TelegramLogType" NOT NULL,
  "message" TEXT NOT NULL,
  "payload" JSONB,
  "telegramId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Settings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT false,
  "autoApplyMinScore" INTEGER NOT NULL DEFAULT 90,
  "maxPerHour" INTEGER NOT NULL DEFAULT 10,
  "maxPerDay" INTEGER NOT NULL DEFAULT 50,
  "schedulerEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "PortalAccount_userId_portal_key" ON "PortalAccount"("userId", "portal");
CREATE UNIQUE INDEX "Listing_userId_normalizedUrl_key" ON "Listing"("userId", "normalizedUrl");
CREATE INDEX "Listing_userId_status_idx" ON "Listing"("userId", "status");
CREATE INDEX "Listing_address_title_provider_idx" ON "Listing"("address", "title", "provider");
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");

ALTER TABLE "SearchProfile" ADD CONSTRAINT "SearchProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalAccount" ADD CONSTRAINT "PortalAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "SearchProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramLog" ADD CONSTRAINT "TelegramLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
