import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ConfirmationState,
  Prisma,
  PrizeState,
} from "@prisma/client";
import { RULES, drawSchema, type LotterySlug } from "@atlas/contracts";
import { createHash, randomInt } from "node:crypto";
import { PrismaService } from "./database.js";

type AnalyticsGame = {
  numbers: number[];
  score: number | null;
  explanation: Record<string, unknown>;
};

@Injectable()
export class LotteryFlowService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async importConfirmed(raw: unknown) {
    const input = drawSchema.parse(raw);
    const numbers = [...input.numbers].sort((a, b) => a - b);
    const hash = createHash("sha256")
      .update(JSON.stringify(raw))
      .digest("hex");
    const existing = await this.prisma.drawRevision.findFirst({
      where: {
        draw: {
          lottery: { slug: input.lottery },
          contestNumber: input.contestNumber,
        },
        payloadHash: hash,
      },
    });
    if (existing) return { revisionId: existing.id, duplicate: true };

    const revision = await this.prisma.$transaction(async (tx) => {
      const lottery = await tx.lottery.upsert({
        where: { slug: input.lottery },
        update: {},
        create: {
          slug: input.lottery,
          name: input.lottery,
        },
      });
      const draw = await tx.draw.upsert({
        where: {
          lotteryId_contestNumber: {
            lotteryId: lottery.id,
            contestNumber: input.contestNumber,
          },
        },
        update: { drawDate: new Date(`${input.drawDate}T12:00:00Z`) },
        create: {
          lotteryId: lottery.id,
          contestNumber: input.contestNumber,
          drawDate: new Date(`${input.drawDate}T12:00:00Z`),
        },
        include: { revisions: { orderBy: { revision: "desc" }, take: 1 } },
      });
      const created = await tx.drawRevision.create({
        data: {
          drawId: draw.id,
          revision: (draw.revisions[0]?.revision ?? 0) + 1,
          numbers,
          originalOrder: input.numbers,
          luckyMonth: input.luckyMonth ?? null,
          confirmation: ConfirmationState.CONFIRMED,
          prizeState: PrizeState.PENDING,
          sourceUrl: input.sourceUrl,
          fetchedAt: new Date(input.fetchedAt),
          rawPayload: raw as Prisma.InputJsonValue,
          payloadHash: hash,
          parserVersion: input.parserVersion,
        },
      });
      if (draw.canonicalRevisionId) {
        await tx.drawRevision.update({
          where: { id: draw.canonicalRevisionId },
          data: { supersededAt: new Date() },
        });
      }
      await tx.draw.update({
        where: { id: draw.id },
        data: { canonicalRevisionId: created.id },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "Draw",
          aggregateId: draw.id,
          type: draw.canonicalRevisionId ? "draw.corrected" : "draw.confirmed",
          idempotencyKey: `${input.lottery}:${input.contestNumber}:${created.revision}`,
          payload: {
            lottery: input.lottery,
            contestNumber: input.contestNumber,
            revisionId: created.id,
          },
        },
      });
      return created;
    });
    await this.evaluateGames(input.lottery, revision.id, numbers, input.luckyMonth);
    const confirmedCount = await this.prisma.draw.count({
      where: {
        lottery: { slug: input.lottery },
        canonicalRevisionId: { not: null },
      },
    });
    if (confirmedCount < 2) {
      return {
        revisionId: revision.id,
        duplicate: false,
        analysisStatus: "WAITING_FOR_MINIMUM_HISTORY",
      };
    }
    const analysis = await this.recalculate(input.lottery);
    return {
      revisionId: revision.id,
      duplicate: false,
      snapshotId: analysis.snapshotId,
      suggestionBatchId: analysis.batchId,
    };
  }

  async recalculate(slug: LotterySlug) {
    const dataset = await this.dataset(slug);
    if (dataset.draws.length < 2) {
      throw new BadRequestException("São necessários pelo menos dois concursos");
    }
    const rules = RULES[slug];
    const analysis = await this.analytics("/v1/analyze", {
      dataset,
      windows: [10, 25, 50, 100, 250],
    });
    const generation = (await this.analytics("/v1/generate", {
      dataset,
      strategy: "recent-frequency",
      count: 5,
      pick_count: rules.simplePick,
      seed: randomInt(1, 2_147_483_647),
      fixed: [],
      excluded: [],
      max_overlap: rules.simplePick - 2,
    })) as {
      seed: number;
      prng: string;
      score_version: string;
      games: AnalyticsGame[];
    };
    const result = await this.prisma.$transaction(async (tx) => {
      const lottery = await tx.lottery.findUniqueOrThrow({ where: { slug } });
      const previous = await tx.suggestionBatch.findFirst({
        where: { userId: null, snapshot: { lotteryId: lottery.id } },
        orderBy: { createdAt: "desc" },
      });
      const snapshot = await tx.analysisSnapshot.create({
        data: {
          lotteryId: lottery.id,
          cutoffContest: dataset.contest_numbers.at(-1)!,
          datasetHash: dataset.dataset_hash,
          version: "descriptive-v1",
          status: "PUBLISHED",
          windows: [10, 25, 50, 100, 250],
          metadata: analysis as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
      });
      const strategy = await tx.strategy.upsert({
        where: {
          lotteryId_code: {
            lotteryId: lottery.id,
            code: "recent-frequency",
          },
        },
        update: {},
        create: {
          lotteryId: lottery.id,
          code: "recent-frequency",
          name: "Frequência recente suavizada",
        },
      });
      const strategyVersion = await tx.strategyVersion.upsert({
        where: {
          strategyId_version: { strategyId: strategy.id, version: "1.0.0" },
        },
        update: {},
        create: {
          strategyId: strategy.id,
          version: "1.0.0",
          parameters: { smoothing: "count+1", weightedWithoutReplacement: true },
          status: "ACTIVE",
        },
      });
      const batch = await tx.suggestionBatch.create({
        data: {
          snapshotId: snapshot.id,
          strategyVersionId: strategyVersion.id,
          targetContest: dataset.contest_numbers.at(-1)! + 1,
          seed: String(generation.seed),
          prng: generation.prng,
          constraints: {},
          datasetHash: dataset.dataset_hash,
          scoreVersion: generation.score_version,
          status: "PUBLISHED",
          previousBatchId: previous?.id,
          publishedAt: new Date(),
          games: {
            create: generation.games.map((game) => ({
              numbers: game.numbers,
              score: game.score ?? 0,
              scoreBreakdown: game.explanation as Prisma.InputJsonValue,
            })),
          },
        },
      });
      return { snapshot, batch };
    });
    return { snapshotId: result.snapshot.id, batchId: result.batch.id };
  }

  async latest(slug: LotterySlug) {
    const lottery = await this.prisma.lottery.findUnique({ where: { slug } });
    if (!lottery) throw new NotFoundException("Modalidade sem dados");
    return this.prisma.suggestionBatch.findFirst({
      where: { snapshot: { lotteryId: lottery.id }, userId: null },
      orderBy: { createdAt: "desc" },
      include: { games: true, snapshot: true, strategyVersion: true },
    });
  }

  async saveGame(userId: string, suggestedGameId: string, name?: string) {
    const suggestion = await this.prisma.suggestedGame.findUnique({
      where: { id: suggestedGameId },
      include: { batch: { include: { snapshot: { include: { lottery: true } } } } },
    });
    if (!suggestion) throw new NotFoundException("Sugestão não encontrada");
    return this.prisma.withUser(userId, (tx) =>
      tx.savedGame.create({
        data: {
          userId,
          suggestedGameId,
          lotterySlug: suggestion.batch.snapshot.lottery.slug,
          numbers: suggestion.numbers,
          luckyMonth: suggestion.luckyMonth,
          name: name ?? "Jogo salvo",
          tags: [],
        },
      }),
    );
  }

  async userGames(userId: string) {
    return this.prisma.withUser(userId, (tx) =>
      tx.savedGame.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { evaluations: { include: { drawRevision: true } } },
      }),
    );
  }

  private async evaluateGames(
    slug: LotterySlug,
    revisionId: string,
    numbers: number[],
    month?: number | null,
  ) {
    const games = await this.prisma.savedGame.findMany({
      where: { lotterySlug: slug },
    });
    for (const game of games) {
      await this.prisma.gameEvaluation.upsert({
        where: {
          savedGameId_drawRevisionId: {
            savedGameId: game.id,
            drawRevisionId: revisionId,
          },
        },
        update: {
          numberHits: game.numbers.filter((number) => numbers.includes(number)).length,
          luckyMonthHit:
            slug === "dia-de-sorte" ? game.luckyMonth === month : null,
        },
        create: {
          savedGameId: game.id,
          drawRevisionId: revisionId,
          numberHits: game.numbers.filter((number) => numbers.includes(number)).length,
          luckyMonthHit:
            slug === "dia-de-sorte" ? game.luckyMonth === month : null,
          mode: "FUTURE_TRACKING",
        },
      });
    }
  }

  private async dataset(slug: LotterySlug) {
    const draws = await this.prisma.draw.findMany({
      where: { lottery: { slug }, canonicalRevisionId: { not: null } },
      orderBy: { contestNumber: "asc" },
      include: { revisions: true },
    });
    const canonical = draws.map((draw) => ({
      contest: draw.contestNumber,
      numbers: draw.revisions.find((r) => r.id === draw.canonicalRevisionId)!.numbers,
    }));
    const raw = canonical
      .map((draw) => `${draw.contest}:${[...draw.numbers].sort((a, b) => a - b).join(",")}`)
      .join("|");
    const rules = RULES[slug];
    return {
      lottery: slug,
      universe: rules.universe,
      drawn_count: rules.drawn,
      contest_numbers: canonical.map((draw) => draw.contest),
      draws: canonical.map((draw) => draw.numbers),
      dataset_hash: createHash("sha256").update(raw).digest("hex"),
    };
  }

  private async analytics(path: string, body: unknown): Promise<unknown> {
    const base = process.env.INTERNAL_ANALYTICS_URL ?? "http://localhost:8001";
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new BadGatewayException(`Analytics respondeu ${response.status}`);
    }
    return response.json();
  }
}
