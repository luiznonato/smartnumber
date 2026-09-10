-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'SUPPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ConfirmationState" AS ENUM ('PENDING', 'CONFIRMED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "PrizeState" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "budgetLimitCents" INTEGER,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limits" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "status" "SubscriptionStatus" NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lottery" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Lottery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryRuleVersion" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "universe" INTEGER NOT NULL,
    "drawnCount" INTEGER NOT NULL,
    "minPick" INTEGER NOT NULL,
    "maxPick" INTEGER NOT NULL,
    "luckyMonth" BOOLEAN NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "LotteryRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "contestNumber" INTEGER NOT NULL,
    "canonicalRevisionId" TEXT,
    "drawDate" TIMESTAMP(3) NOT NULL,
    "drawTime" TEXT,
    "specialName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawRevision" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "numbers" INTEGER[],
    "originalOrder" INTEGER[],
    "luckyMonth" INTEGER,
    "confirmation" "ConfirmationState" NOT NULL,
    "prizeState" "PrizeState" NOT NULL DEFAULT 'PENDING',
    "sourceUrl" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeTier" (
    "id" TEXT NOT NULL,
    "drawRevisionId" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "luckyMonthRequired" BOOLEAN NOT NULL DEFAULT false,
    "winners" INTEGER,
    "amountCents" BIGINT,
    "label" TEXT NOT NULL,

    CONSTRAINT "PrizeTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFetch" (
    "id" TEXT NOT NULL,
    "lotterySlug" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "statusCode" INTEGER,
    "payloadHash" TEXT,
    "rawPayload" JSONB,
    "parserVersion" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "SourceFetch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "lotterySlug" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "checkpoint" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL,
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsAccepted" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "lotterySlug" TEXT NOT NULL,
    "contestNumber" INTEGER,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisSnapshot" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "cutoffContest" INTEGER NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "windows" INTEGER[],
    "metadata" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberStatistic" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "frequency" DOUBLE PRECISION NOT NULL,
    "expected" DOUBLE PRECISION NOT NULL,
    "ema" DOUBLE PRECISION NOT NULL,
    "gap" INTEGER,
    "uncertainty" JSONB NOT NULL,

    CONSTRAINT "NumberStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairStatistic" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "a" INTEGER NOT NULL,
    "b" INTEGER NOT NULL,
    "observed" INTEGER NOT NULL,
    "expected" DOUBLE PRECISION NOT NULL,
    "support" DOUBLE PRECISION NOT NULL,
    "deviation" DOUBLE PRECISION NOT NULL,
    "qValue" DOUBLE PRECISION,

    CONSTRAINT "PairStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternStatistic" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "formulaVersion" TEXT NOT NULL,

    CONSTRAINT "PatternStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeVersionId" TEXT,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyVersion" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionBatch" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "userId" TEXT,
    "targetContest" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "prng" TEXT NOT NULL,
    "constraints" JSONB NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "scoreVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "previousBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "SuggestionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedGame" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "numbers" INTEGER[],
    "luckyMonth" INTEGER,
    "score" DOUBLE PRECISION NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "estimatedCostCents" INTEGER,

    CONSTRAINT "SuggestedGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suggestedGameId" TEXT,
    "lotterySlug" TEXT NOT NULL,
    "numbers" INTEGER[],
    "luckyMonth" INTEGER,
    "name" TEXT NOT NULL,
    "tags" TEXT[],
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRevision" (
    "id" TEXT NOT NULL,
    "savedGameId" TEXT NOT NULL,
    "numbers" INTEGER[],
    "luckyMonth" INTEGER,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingSubscription" (
    "id" TEXT NOT NULL,
    "savedGameId" TEXT NOT NULL,
    "startContest" INTEGER NOT NULL,
    "endContest" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrackingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedGameId" TEXT NOT NULL,
    "contestNumber" INTEGER NOT NULL,
    "declaredCostCents" INTEGER,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "retroactive" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "receivedAmountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvaluation" (
    "id" TEXT NOT NULL,
    "savedGameId" TEXT NOT NULL,
    "drawRevisionId" TEXT NOT NULL,
    "numberHits" INTEGER NOT NULL,
    "luckyMonthHit" BOOLEAN,
    "prizeTier" TEXT,
    "officialAmountCents" BIGINT,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "strategyVersion" TEXT NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestFold" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "trainEnd" INTEGER NOT NULL,
    "validationEnd" INTEGER NOT NULL,
    "testStart" INTEGER NOT NULL,
    "testEnd" INTEGER NOT NULL,

    CONSTRAINT "BacktestFold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestMetric" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "confidenceLow" DOUBLE PRECISION,
    "confidenceHigh" DOUBLE PRECISION,
    "sampleSize" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "BacktestMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectiveEvaluation" (
    "id" TEXT NOT NULL,
    "suggestionBatchId" TEXT NOT NULL,
    "contestNumber" INTEGER NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "eligibilityReason" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "resultKnownAt" TIMESTAMP(3),
    "metrics" JSONB,

    CONSTRAINT "ProspectiveEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "checkpoint" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pausedUntil" TIMESTAMP(3),

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipHash" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_planId_key_key" ON "Entitlement"("planId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_externalId_key" ON "Subscription"("externalId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_provider_externalId_key" ON "BillingEvent"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_key_period_key" ON "UsageCounter"("userId", "key", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Lottery_slug_key" ON "Lottery"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryRuleVersion_lotteryId_validFrom_key" ON "LotteryRuleVersion"("lotteryId", "validFrom");

-- CreateIndex
CREATE INDEX "Draw_lotteryId_drawDate_idx" ON "Draw"("lotteryId", "drawDate");

-- CreateIndex
CREATE UNIQUE INDEX "Draw_lotteryId_contestNumber_key" ON "Draw"("lotteryId", "contestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DrawRevision_drawId_revision_key" ON "DrawRevision"("drawId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "DrawRevision_drawId_payloadHash_key" ON "DrawRevision"("drawId", "payloadHash");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeTier_drawRevisionId_label_key" ON "PrizeTier"("drawRevisionId", "label");

-- CreateIndex
CREATE INDEX "DataQualityIssue_lotterySlug_resolvedAt_idx" ON "DataQualityIssue"("lotterySlug", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisSnapshot_lotteryId_cutoffContest_datasetHash_versio_key" ON "AnalysisSnapshot"("lotteryId", "cutoffContest", "datasetHash", "version");

-- CreateIndex
CREATE UNIQUE INDEX "NumberStatistic_snapshotId_window_number_key" ON "NumberStatistic"("snapshotId", "window", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PairStatistic_snapshotId_window_a_b_key" ON "PairStatistic"("snapshotId", "window", "a", "b");

-- CreateIndex
CREATE UNIQUE INDEX "PatternStatistic_snapshotId_window_key_key" ON "PatternStatistic"("snapshotId", "window", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Strategy_lotteryId_code_key" ON "Strategy"("lotteryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyVersion_strategyId_version_key" ON "StrategyVersion"("strategyId", "version");

-- CreateIndex
CREATE INDEX "SuggestionBatch_userId_createdAt_idx" ON "SuggestionBatch"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestedGame_batchId_numbers_luckyMonth_key" ON "SuggestedGame"("batchId", "numbers", "luckyMonth");

-- CreateIndex
CREATE INDEX "SavedGame_userId_lotterySlug_createdAt_idx" ON "SavedGame"("userId", "lotterySlug", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BetRecord_userId_savedGameId_contestNumber_key" ON "BetRecord"("userId", "savedGameId", "contestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvaluation_savedGameId_drawRevisionId_key" ON "GameEvaluation"("savedGameId", "drawRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestFold_runId_testStart_testEnd_key" ON "BacktestFold"("runId", "testStart", "testEnd");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestMetric_runId_name_key" ON "BacktestMetric"("runId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectiveEvaluation_suggestionBatchId_contestNumber_key" ON "ProspectiveEvaluation"("suggestionBatchId", "contestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_idempotencyKey_key" ON "OutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_createdAt_idx" ON "OutboxEvent"("publishedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_queue_jobKey_version_key" ON "JobRun"("queue", "jobKey", "version");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_type_key" ON "NotificationPreference"("userId", "channel", "type");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_createdAt_idx" ON "AuditLog"("resourceType", "resourceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryRuleVersion" ADD CONSTRAINT "LotteryRuleVersion_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawRevision" ADD CONSTRAINT "DrawRevision_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeTier" ADD CONSTRAINT "PrizeTier_drawRevisionId_fkey" FOREIGN KEY ("drawRevisionId") REFERENCES "DrawRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSnapshot" ADD CONSTRAINT "AnalysisSnapshot_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberStatistic" ADD CONSTRAINT "NumberStatistic_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AnalysisSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairStatistic" ADD CONSTRAINT "PairStatistic_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AnalysisSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternStatistic" ADD CONSTRAINT "PatternStatistic_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AnalysisSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionBatch" ADD CONSTRAINT "SuggestionBatch_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AnalysisSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionBatch" ADD CONSTRAINT "SuggestionBatch_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedGame" ADD CONSTRAINT "SuggestedGame_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SuggestionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedGame" ADD CONSTRAINT "SavedGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedGame" ADD CONSTRAINT "SavedGame_suggestedGameId_fkey" FOREIGN KEY ("suggestedGameId") REFERENCES "SuggestedGame"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRevision" ADD CONSTRAINT "GameRevision_savedGameId_fkey" FOREIGN KEY ("savedGameId") REFERENCES "SavedGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSubscription" ADD CONSTRAINT "TrackingSubscription_savedGameId_fkey" FOREIGN KEY ("savedGameId") REFERENCES "SavedGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetRecord" ADD CONSTRAINT "BetRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetRecord" ADD CONSTRAINT "BetRecord_savedGameId_fkey" FOREIGN KEY ("savedGameId") REFERENCES "SavedGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvaluation" ADD CONSTRAINT "GameEvaluation_savedGameId_fkey" FOREIGN KEY ("savedGameId") REFERENCES "SavedGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvaluation" ADD CONSTRAINT "GameEvaluation_drawRevisionId_fkey" FOREIGN KEY ("drawRevisionId") REFERENCES "DrawRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestFold" ADD CONSTRAINT "BacktestFold_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestMetric" ADD CONSTRAINT "BacktestMetric_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

