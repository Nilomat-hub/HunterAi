ALTER TABLE "User"
  ADD COLUMN "dualStudyProgram" TEXT,
  ADD COLUMN "monthlyAvailableBudget" INTEGER,
  ADD COLUMN "guarantorAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "currentHousingSituation" TEXT,
  ADD COLUMN "moveReason" TEXT,
  ADD COLUMN "locationBenefit" TEXT;
