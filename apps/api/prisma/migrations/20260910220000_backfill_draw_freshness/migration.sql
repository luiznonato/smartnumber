UPDATE "Lottery" AS lottery
SET "freshnessStatus" = 'UNVERIFIED'
WHERE lottery."freshnessStatus" = 'NO_RESULTS'
  AND EXISTS (
    SELECT 1
    FROM "Draw"
    WHERE "Draw"."lotteryId" = lottery.id
      AND "Draw"."canonicalRevisionId" IS NOT NULL
  );
