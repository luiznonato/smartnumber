ALTER TABLE "GameEvaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GameEvaluation" FORCE ROW LEVEL SECURITY;

CREATE POLICY game_evaluation_owner ON "GameEvaluation"
  USING (
    EXISTS (
      SELECT 1
      FROM "SavedGame"
      WHERE "SavedGame".id = "GameEvaluation"."savedGameId"
        AND "SavedGame"."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "SavedGame"
      WHERE "SavedGame".id = "GameEvaluation"."savedGameId"
        AND "SavedGame"."userId" = current_setting('app.user_id', true)
    )
  );
