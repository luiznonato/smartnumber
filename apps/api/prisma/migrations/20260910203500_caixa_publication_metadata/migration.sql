ALTER TABLE "Lottery"
  ADD COLUMN "sourceLatestContest" INTEGER,
  ADD COLUMN "nextContestNumber" INTEGER,
  ADD COLUMN "nextDrawDate" TIMESTAMP(3),
  ADD COLUMN "estimatedPrizeCents" BIGINT,
  ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3);
