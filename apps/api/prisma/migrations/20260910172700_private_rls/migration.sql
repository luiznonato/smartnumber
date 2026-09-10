-- Defense in depth. The application transaction must execute:
-- SET LOCAL app.user_id = '<authenticated user uuid>';
ALTER TABLE "SavedGame" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedGame" FORCE ROW LEVEL SECURITY;
CREATE POLICY saved_game_owner ON "SavedGame"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "BetRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BetRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY bet_record_owner ON "BetRecord"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_owner ON "Notification"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "UserPreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPreferences" FORCE ROW LEVEL SECURITY;
CREATE POLICY preferences_owner ON "UserPreferences"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));
