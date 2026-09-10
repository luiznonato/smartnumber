import { PrismaClient, Role } from "@prisma/client";
import { RULES, type LotterySlug } from "@atlas/contracts";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AuthService } from "./auth.service.js";
import { hashPassword } from "./auth.js";
import { PrismaService } from "./database.js";
import { CaixaServiceBusProvider } from "./ingestion.js";
import { LotteryFlowService } from "./lottery-flow.service.js";
import { OFFICIAL_LIFECYCLE_FIXTURES } from "./official-lifecycle-fixtures.js";
import * as OTPAuth from "otpauth";

const enabled =
  process.env.RUN_DB_INTEGRATION === "1" &&
  Boolean(process.env.TEST_ADMIN_DATABASE_URL) &&
  Boolean(process.env.DATABASE_URL);

const suite = enabled ? describe : describe.skip;

suite("persistent official-result lifecycle", () => {
  const admin = new PrismaClient({
    datasources: { db: { url: process.env.TEST_ADMIN_DATABASE_URL } },
  });
  const prisma = new PrismaService();
  const auth = new AuthService(prisma);
  const flow = new LotteryFlowService(prisma);
  const provider = new CaixaServiceBusProvider();

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("_test")) {
      throw new Error("DATABASE_URL de integração deve apontar para banco *_test");
    }
    await admin.$connect();
    await prisma.onModuleInit();
    process.env.CAIXA_ENABLED = "true";
    process.env.SESSION_SECRET =
      "integration-session-secret-with-32-characters";
    process.env.ADMIN_MFA_ENCRYPTION_KEY =
      "integration-mfa-encryption-key-32-characters";
  }, 30_000);

  beforeEach(async () => {
    await admin.$executeRawUnsafe(`
      DO $$
      DECLARE row RECORD;
      BEGIN
        FOR row IN
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
        LOOP
          EXECUTE format('TRUNCATE TABLE %I CASCADE', row.tablename);
        END LOOP;
      END $$;
    `);
  }, 30_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await admin.$disconnect();
    delete process.env.CAIXA_ENABLED;
    delete process.env.SESSION_SECRET;
    delete process.env.ADMIN_MFA_ENCRYPTION_KEY;
  });

  it.each(Object.keys(OFFICIAL_LIFECYCLE_FIXTURES) as LotterySlug[])(
    "preserves and evaluates a %s suggestion before publishing its successor",
    async (lottery) => {
      const fixtures = OFFICIAL_LIFECYCLE_FIXTURES[lottery];
      const normalized = fixtures.map((fixture) =>
        provider.normalize(lottery, fixture).input,
      );
      const subscriber = await auth.register(
        `${lottery}-${crypto.randomUUID()}@integration.test`,
        "integration-password",
      );

      const firstImport = await flow.importConfirmed(normalized[0], fixtures[0]);
      const first = await flow.processRevision(firstImport.revisionId);
      expect(first.analysisStatus).toBe("WAITING_FOR_MINIMUM_HISTORY");

      const secondImport = await flow.importConfirmed(normalized[1], fixtures[1]);
      const second = await flow.processRevision(secondImport.revisionId);
      expect(second.snapshotId).toBeTruthy();
      expect(second.analysisStatus).toBe("WAITING_FOR_STRATEGY_SAMPLE");
      const originalBatch = await flow.generateForUser(subscriber.user.id, {
        lottery,
        strategy: "uniform",
        count: 5,
        seed: 1234,
      });
      expect(originalBatch.games).toHaveLength(5);
      expect(originalBatch.games[0].numbers).toHaveLength(
        RULES[lottery].simplePick,
      );

      if (lottery === "dia-de-sorte") {
        expect(originalBatch.games[0].luckyMonth).toBeGreaterThanOrEqual(1);
        expect(originalBatch.games[0].luckyMonth).toBeLessThanOrEqual(12);
        expect(originalBatch.constraints).toMatchObject({
          luckyMonth: {
            strategy: "uniform-random-reference",
            prng: "sha256-counter-v1",
          },
        });
      } else {
        expect(originalBatch.games[0].luckyMonth).toBeNull();
      }

      const original = await flow.saveGame(
        subscriber.user.id,
        originalBatch.games[0].id,
        `Original ${lottery}`,
      );
      const originalNumbers = [...original.numbers];
      const originalMonth = original.luckyMonth;

      const thirdImport = await flow.importConfirmed(normalized[2], fixtures[2]);
      const third = await flow.processRevision(thirdImport.revisionId);
      expect(third.snapshotId).toBeTruthy();
      const successor = await flow.generateForUser(subscriber.user.id, {
        lottery,
        strategy: "uniform",
        count: 5,
        seed: 5678,
      });
      expect(successor.id).not.toBe(originalBatch.id);
      expect(successor.previousBatchId).toBe(originalBatch.id);
      const replay = await flow.processRevision(thirdImport.revisionId);
      expect(replay.duplicate).toBe(true);
      const batches = await admin.suggestionBatch.findMany({
        where: { userId: subscriber.user.id },
        orderBy: { createdAt: "desc" },
      });
      expect(batches[0].id).toBe(successor.id);

      const games = await flow.userGames(subscriber.user.id);
      const saved = games.find((game) => game.id === original.id);
      expect(saved?.numbers).toEqual(originalNumbers);
      expect(saved?.luckyMonth).toBe(originalMonth);
      expect(saved?.evaluations).toHaveLength(1);

      const expectedHits = originalNumbers.filter((number) =>
        normalized[2].numbers.includes(number),
      ).length;
      expect(saved?.evaluations[0].numberHits).toBe(expectedHits);
      expect(saved?.evaluations[0].luckyMonthHit).toBe(
        lottery === "dia-de-sorte"
          ? originalMonth === normalized[2].luckyMonth
          : null,
      );
    },
    60_000,
  );

  it("synchronizes official history in resumable audited batches", async () => {
    const fixtures = OFFICIAL_LIFECYCLE_FIXTURES["dia-de-sorte"];
    const officialThird = {
      ...fixtures[2],
      numeroConcursoProximo: 4,
      dataProximoConcurso: "26/05/2018",
      valorEstimadoProximoConcurso: 500000,
      listaRateioPremio: [
        {
          descricaoFaixa: "7 acertos",
          numeroDeGanhadores: 1,
          valorPremio: 769663.08,
        },
        {
          descricaoFaixa: "Mês da Sorte",
          numeroDeGanhadores: 237328,
          valorPremio: 2,
        },
      ],
    };
    const latest = provider.normalize("dia-de-sorte", officialThird);
    vi.spyOn(CaixaServiceBusProvider.prototype, "latest").mockResolvedValue(
      latest,
    );
    vi.spyOn(
      CaixaServiceBusProvider.prototype,
      "byContest",
    ).mockImplementation(async (_lottery, contest) =>
      provider.normalize(
        "dia-de-sorte",
        contest === 3 ? officialThird : fixtures[contest - 1],
      ),
    );

    const firstBatch = await flow.syncHistoryBatch("dia-de-sorte", {
      limit: 2,
    });
    expect(firstBatch.completed).toBe(false);
    expect(firstBatch.nextContest).toBe(3);

    const finalBatch = await flow.syncHistoryBatch("dia-de-sorte", {
      resumeId: firstBatch.importRunId,
      limit: 2,
    });
    expect(finalBatch.completed).toBe(true);

    const health = await flow.dataHealth("dia-de-sorte");
    expect(health).toMatchObject({
      confirmedDraws: 3,
      firstContest: 1,
      lastContest: 3,
      nextContestNumber: 4,
      complete: true,
      gaps: [],
    });
    expect(await admin.sourceFetch.count()).toBe(4);
    const thirdDraw = await admin.draw.findFirstOrThrow({
      where: {
        lottery: { slug: "dia-de-sorte" },
        contestNumber: 3,
      },
      include: {
        revisions: { include: { prizeTiers: true } },
      },
    });
    const canonical = thirdDraw.revisions.find(
      (revision) => revision.id === thirdDraw.canonicalRevisionId,
    );
    expect(canonical?.prizeState).toBe("CONFIRMED");
    expect(canonical?.prizeTiers).toHaveLength(2);
    const latestDraw = await flow.latestDraw("dia-de-sorte");
    expect(latestDraw).toMatchObject({
      state: "VERIFIED",
      sourceLatestContest: 3,
      draw: {
        contestNumber: 3,
        luckyMonth: 4,
        prizeState: "CONFIRMED",
      },
      nextContest: { contestNumber: 4, drawDate: "2018-05-26" },
    });
  });

  it("requires MFA before issuing an administrative session", async () => {
    await admin.user.create({
      data: {
        email: "admin@integration.test",
        passwordHash: await hashPassword("integration-admin-password"),
        role: Role.ADMIN,
      },
    });
    const challenge = await auth.beginAdminLogin(
      "admin@integration.test",
      "integration-admin-password",
    );
    expect(challenge.setupRequired).toBe(true);
    expect(challenge.setup?.secret).toBeTruthy();
    const totp = new OTPAuth.TOTP({
      issuer: "Atlas Loto",
      label: "admin@integration.test",
      secret: OTPAuth.Secret.fromBase32(challenge.setup!.secret),
    });
    const completed = await auth.completeAdminMfa(
      challenge.challenge,
      totp.generate(),
      true,
    );
    expect(completed.recoveryCodes).toHaveLength(8);
    const session = await admin.session.findFirstOrThrow({
      where: { userId: completed.user.id },
      orderBy: { createdAt: "desc" },
    });
    expect(session.adminMfaVerifiedAt).not.toBeNull();
    const storedAdmin = await admin.user.findUniqueOrThrow({
      where: { email: "admin@integration.test" },
    });
    expect(storedAdmin.adminMfaEnabledAt).not.toBeNull();
    expect(storedAdmin.adminMfaRecoveryHashes).toHaveLength(8);
  });
});
