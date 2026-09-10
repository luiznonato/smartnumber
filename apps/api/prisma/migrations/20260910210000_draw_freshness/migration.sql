ALTER TABLE "Lottery"
  ADD COLUMN "dataCoverage" JSONB,
  ADD COLUMN "freshnessStatus" TEXT NOT NULL DEFAULT 'NO_RESULTS';

ALTER TABLE "DrawRevision"
  ADD COLUMN "sourceVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "accumulated" BOOLEAN;

ALTER TABLE "SuggestedGame"
  ALTER COLUMN "score" DROP NOT NULL;

ALTER TABLE "SuggestionBatch"
  ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "SuggestionBatch_userId_requestKey_key"
  ON "SuggestionBatch"("userId", "requestKey");

ALTER TABLE "ImportRun"
  ADD COLUMN "sourceFileName" TEXT,
  ADD COLUMN "sourceFileHash" TEXT,
  ADD COLUMN "actorUserId" TEXT,
  ADD COLUMN "preview" JSONB;

ALTER TABLE "User"
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "adminMfaSecretEncrypted" TEXT,
  ADD COLUMN "adminMfaEnabledAt" TIMESTAMP(3),
  ADD COLUMN "adminMfaRecoveryHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Session"
  ADD COLUMN "adminMfaVerifiedAt" TIMESTAMP(3);

ALTER TABLE "SuggestionBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuggestionBatch" FORCE ROW LEVEL SECURITY;
CREATE POLICY suggestion_batch_visibility ON "SuggestionBatch"
  USING ("userId" IS NULL OR "userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" IS NULL OR "userId" = current_setting('app.user_id', true));

ALTER TABLE "SuggestedGame" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SuggestedGame" FORCE ROW LEVEL SECURITY;
CREATE POLICY suggested_game_visibility ON "SuggestedGame"
  USING (EXISTS (
    SELECT 1 FROM "SuggestionBatch"
    WHERE "SuggestionBatch".id = "SuggestedGame"."batchId"
      AND ("SuggestionBatch"."userId" IS NULL
        OR "SuggestionBatch"."userId" = current_setting('app.user_id', true))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "SuggestionBatch"
    WHERE "SuggestionBatch".id = "SuggestedGame"."batchId"
      AND ("SuggestionBatch"."userId" IS NULL
        OR "SuggestionBatch"."userId" = current_setting('app.user_id', true))
  ));

ALTER TABLE "GameRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GameRevision" FORCE ROW LEVEL SECURITY;
CREATE POLICY game_revision_owner ON "GameRevision"
  USING (EXISTS (
    SELECT 1 FROM "SavedGame"
    WHERE "SavedGame".id = "GameRevision"."savedGameId"
      AND "SavedGame"."userId" = current_setting('app.user_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "SavedGame"
    WHERE "SavedGame".id = "GameRevision"."savedGameId"
      AND "SavedGame"."userId" = current_setting('app.user_id', true)
  ));

ALTER TABLE "TrackingSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackingSubscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY tracking_owner ON "TrackingSubscription"
  USING (EXISTS (
    SELECT 1 FROM "SavedGame"
    WHERE "SavedGame".id = "TrackingSubscription"."savedGameId"
      AND "SavedGame"."userId" = current_setting('app.user_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "SavedGame"
    WHERE "SavedGame".id = "TrackingSubscription"."savedGameId"
      AND "SavedGame"."userId" = current_setting('app.user_id', true)
  ));

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY subscription_owner ON "Subscription"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "UsageCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageCounter" FORCE ROW LEVEL SECURITY;
CREATE POLICY usage_counter_owner ON "UsageCounter"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_preference_owner ON "NotificationPreference"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));
