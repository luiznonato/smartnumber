import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
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
import {
  CaixaServiceBusProvider,
  type CaixaFetchResult,
  type NormalizedPrizeTier,
} from "./ingestion.js";

type AnalyticsGame = {
  numbers: number[];
  score: number | null;
  explanation: Record<string, unknown>;
};

type AnalyticsGeneration = {
  strategy: string;
  strategy_version: string;
  seed: number;
  prng: string;
  score_version: string | null;
  sample: { n: number; window: number | null };
  parameters?: Record<string, unknown>;
  games: AnalyticsGame[];
};

type ProcessRevisionResult = {
  revisionId: string;
  duplicate: boolean;
  analysisStatus?: string;
  gaps?: Array<{ after: number; before: number }>;
  snapshotId?: string;
  suggestionBatchId?: string;
};

type ImportOptions = {
  publishAnalysis?: boolean;
  prizes?: NormalizedPrizeTier[] | null;
  nextPublication?: CaixaFetchResult["nextContest"];
  sourceLatestContest?: number;
  sourceUpdatedAt?: Date;
  sourceVerifiedAt?: Date;
  accumulated?: boolean | null;
};

export function generateLuckyMonth(monthSeed: string, index: number): number {
  const digest = createHash("sha256")
    .update(`${monthSeed}:${index}`)
    .digest();
  return (digest.readUInt32BE(0) % 12) + 1;
}

@Injectable()
export class LotteryFlowService {
  private readonly caixa = new CaixaServiceBusProvider();
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async importConfirmed(
    raw: unknown,
    sourcePayload: unknown = raw,
    options: ImportOptions = {},
  ) {
    const input = drawSchema.parse(raw);
    const numbers = [...input.numbers].sort((a, b) => a - b);
    const hash = createHash("sha256")
      .update(JSON.stringify(sourcePayload))
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
    if (existing) {
      await this.applyOfficialMetadata(existing.id, input.lottery, options);
      await this.updateCoverage(input.lottery);
      return {
        revisionId: existing.id,
        duplicate: true,
        analysisStatus: "ALREADY_QUEUED_OR_PROCESSED",
      };
    }

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
        update: { drawDate: new Date(`${input.drawDate}T00:00:00.000Z`) },
        create: {
          lotteryId: lottery.id,
          contestNumber: input.contestNumber,
          drawDate: new Date(`${input.drawDate}T00:00:00.000Z`),
        },
        include: { revisions: { orderBy: { revision: "desc" }, take: 1 } },
      });
      const created = await tx.drawRevision.create({
        data: {
          drawId: draw.id,
          revision: (draw.revisions[0]?.revision ?? 0) + 1,
          numbers,
          originalOrder: input.originalOrder ?? [],
          luckyMonth: input.luckyMonth ?? null,
          confirmation: ConfirmationState.CONFIRMED,
          prizeState:
            options.prizes === null || options.prizes === undefined
              ? PrizeState.PENDING
              : PrizeState.CONFIRMED,
          sourceUrl: input.sourceUrl,
          fetchedAt: new Date(input.fetchedAt),
          rawPayload: sourcePayload as Prisma.InputJsonValue,
          payloadHash: hash,
          parserVersion: input.parserVersion,
          sourceVerifiedAt: options.sourceVerifiedAt,
          accumulated: options.accumulated,
          prizeTiers:
            options.prizes === null || options.prizes === undefined
              ? undefined
              : {
                  create: options.prizes.map((tier) => ({
                    label: tier.label,
                    hits: tier.hits,
                    luckyMonthRequired: tier.luckyMonthRequired,
                    winners: tier.winners,
                    amountCents: tier.amountCents,
                  })),
                },
        },
      });
      if (options.nextPublication) {
        await tx.lottery.update({
          where: { id: lottery.id },
          data: {
            sourceLatestContest: options.sourceLatestContest,
            nextContestNumber: options.nextPublication.contestNumber,
            nextDrawDate: options.nextPublication.drawDate
              ? new Date(`${options.nextPublication.drawDate}T00:00:00.000Z`)
              : null,
            estimatedPrizeCents:
              options.nextPublication.estimatedPrizeCents,
            sourceUpdatedAt: options.sourceUpdatedAt ?? new Date(),
          },
        });
      }
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
            publishAnalysis: options.publishAnalysis !== false,
          },
        },
      });
      return created;
    });
    await this.updateCoverage(input.lottery);
    return {
      revisionId: revision.id,
      duplicate: false,
      analysisStatus: "QUEUED",
    };
  }

  async processRevision(
    revisionId: string,
    publishAnalysis = true,
  ): Promise<ProcessRevisionResult> {
    const revision = await this.prisma.drawRevision.findUnique({
      where: { id: revisionId },
      include: { draw: { include: { lottery: true } } },
    });
    if (!revision || revision.confirmation !== ConfirmationState.CONFIRMED) {
      throw new NotFoundException("Revisão confirmada não encontrada");
    }
    const jobKey = `draw-revision:${revisionId}`;
    const job = await this.prisma.jobRun.upsert({
      where: {
        queue_jobKey_version: {
          queue: "draw-events",
          jobKey,
          version: "pipeline-v1",
        },
      },
      update: {},
      create: {
        queue: "draw-events",
        jobKey,
        version: "pipeline-v1",
        status: "PENDING",
      },
    });
    if (job.status === "COMPLETED") {
      return {
        revisionId,
        duplicate: true,
        ...(job.checkpoint as Record<string, unknown> | null),
      };
    }
    await this.prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        startedAt: new Date(),
        error: null,
      },
    });
    try {
      await this.evaluateGames(
        revision.draw.lottery.slug as LotterySlug,
        revision.id,
        revision.numbers,
        revision.luckyMonth,
      );
      if (!publishAnalysis) {
        const result = { analysisStatus: "DEFERRED" };
        await this.completeJob(job.id, result);
        return { revisionId, duplicate: false, ...result };
      }
      const input = {
        lottery: revision.draw.lottery.slug as LotterySlug,
        contestNumber: revision.draw.contestNumber,
      };
    const confirmedCount = await this.prisma.draw.count({
      where: {
        lottery: { slug: input.lottery },
        canonicalRevisionId: { not: null },
      },
    });
    if (confirmedCount < 2) {
      const result = {
        analysisStatus: "WAITING_FOR_MINIMUM_HISTORY",
      };
      await this.completeJob(job.id, result);
      return { revisionId: revision.id, duplicate: false, ...result };
    }
    const contests = await this.prisma.draw.findMany({
      where: {
        lottery: { slug: input.lottery },
        canonicalRevisionId: { not: null },
      },
      orderBy: { contestNumber: "asc" },
      select: { contestNumber: true },
    });
    const gaps: Array<{ after: number; before: number }> = [];
    for (let index = 1; index < contests.length; index++) {
      if (
        contests[index].contestNumber !==
        contests[index - 1].contestNumber + 1
      ) {
        gaps.push({
          after: contests[index - 1].contestNumber,
          before: contests[index].contestNumber,
        });
      }
    }
    if (gaps.length) {
      await this.prisma.dataQualityIssue.create({
        data: {
          lotterySlug: input.lottery,
          severity: "ERROR",
          code: "HISTORY_GAP",
          details: gaps,
        },
      });
      const result = {
        analysisStatus: "BLOCKED_BY_HISTORY_GAPS",
        gaps,
      };
      await this.completeJob(job.id, result);
      return { revisionId: revision.id, duplicate: false, ...result };
    }
    const freshness = await this.prisma.lottery.findUniqueOrThrow({
      where: { slug: input.lottery },
      select: { freshnessStatus: true },
    });
    if (confirmedCount < 10 || freshness.freshnessStatus !== "VERIFIED") {
      const snapshotId = await this.recalculateAnalysisOnly(input.lottery);
      const result = {
        analysisStatus:
          confirmedCount < 10
            ? "WAITING_FOR_STRATEGY_SAMPLE"
            : "ANALYSIS_ONLY_UNVERIFIED_BASE",
        snapshotId,
      };
      await this.completeJob(job.id, result);
      return { revisionId: revision.id, duplicate: false, ...result };
    }
    const analysis = await this.recalculate(input.lottery);
    const result = {
      snapshotId: analysis.snapshotId,
      suggestionBatchId: analysis.batchId,
    };
      await this.completeJob(job.id, result);
      return { revisionId: revision.id, duplicate: false, ...result };
    } catch (error) {
      await this.prisma.jobRun.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async syncLatest(slug: LotterySlug) {
    this.assertCaixaEnabled();
    try {
      const fetched = await this.caixa.latest(slug);
      await this.recordSourceFetch(slug, fetched);
      return this.importConfirmed(fetched.input, fetched.raw, {
        prizes: fetched.prizes,
        nextPublication: fetched.nextContest,
        sourceLatestContest: fetched.input.contestNumber,
        sourceUpdatedAt: fetched.fetchedAt,
        sourceVerifiedAt: fetched.fetchedAt,
        accumulated: fetched.accumulated,
      });
    } catch (error) {
      await this.recordSourceFailure(slug, undefined, error);
      throw new BadGatewayException(
        error instanceof Error ? error.message : "Fonte CAIXA indisponível",
      );
    }
  }

  async syncHistoryBatch(
    slug: LotterySlug,
    options: {
      startContest?: number;
      endContest?: number;
      limit?: number;
      resumeId?: string;
    } = {},
  ) {
    this.assertCaixaEnabled();
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const resumed = options.resumeId
      ? await this.prisma.importRun.findUnique({
          where: { id: options.resumeId },
        })
      : null;
    if (options.resumeId && !resumed) {
      throw new NotFoundException("Importação para retomada não encontrada");
    }
    if (resumed && resumed.lotterySlug !== slug) {
      throw new BadRequestException("Importação pertence a outra modalidade");
    }
    const checkpoint =
      resumed?.checkpoint &&
      typeof resumed.checkpoint === "object" &&
      !Array.isArray(resumed.checkpoint)
        ? (resumed.checkpoint as Record<string, unknown>)
        : {};
    let endContest = Number(
      checkpoint.endContest ?? options.endContest ?? 0,
    );
    if (!Number.isInteger(endContest) || endContest < 1) {
      try {
        const latest = await this.caixa.latest(slug);
        await this.recordSourceFetch(slug, latest);
        endContest = latest.input.contestNumber;
        await this.updateLotteryPublication(slug, latest);
      } catch (error) {
        await this.recordSourceFailure(slug, undefined, error);
        throw new BadGatewayException(
          error instanceof Error ? error.message : "Fonte CAIXA indisponível",
        );
      }
    }
    let nextContest = Number(
      checkpoint.nextContest ?? options.startContest ?? 1,
    );
    if (
      !Number.isInteger(nextContest) ||
      nextContest < 1 ||
      nextContest > endContest
    ) {
      throw new BadRequestException("Intervalo histórico inválido");
    }
    const run = resumed
      ? await this.prisma.importRun.update({
          where: { id: resumed.id },
          data: { status: "RUNNING", finishedAt: null },
        })
      : await this.prisma.importRun.create({
          data: {
            lotterySlug: slug,
            format: "caixa-portal-servicebus-v2",
            checkpoint: { nextContest, endContest },
            status: "RUNNING",
          },
        });
    let accepted = run.recordsAccepted;
    let read = run.recordsRead;
    try {
      const batchEnd = Math.min(endContest, nextContest + limit - 1);
      for (let contest = nextContest; contest <= batchEnd; contest++) {
        let fetched: CaixaFetchResult;
        try {
          fetched = await this.caixa.byContest(slug, contest);
          await this.recordSourceFetch(slug, fetched);
        } catch (error) {
          await this.recordSourceFailure(slug, contest, error);
          throw error;
        }
        await this.importConfirmed(fetched.input, fetched.raw, {
          publishAnalysis: contest === endContest,
          prizes: fetched.prizes,
          nextPublication:
            contest === endContest ? fetched.nextContest : undefined,
          sourceLatestContest:
            contest === endContest ? endContest : undefined,
          sourceUpdatedAt: fetched.fetchedAt,
          sourceVerifiedAt: fetched.fetchedAt,
          accumulated: fetched.accumulated,
        });
        accepted += 1;
        read += 1;
        nextContest = contest + 1;
        await this.prisma.importRun.update({
          where: { id: run.id },
          data: {
            checkpoint: { nextContest, endContest },
            recordsRead: read,
            recordsAccepted: accepted,
          },
        });
        if (contest < batchEnd) {
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.max(Number(process.env.CAIXA_REQUEST_DELAY_MS ?? 250), 200),
            ),
          );
        }
      }
      const completed = nextContest > endContest;
      await this.prisma.importRun.update({
        where: { id: run.id },
        data: {
          status: completed ? "COMPLETED" : "PENDING",
          finishedAt: completed ? new Date() : null,
        },
      });
      return {
        importRunId: run.id,
        accepted,
        nextContest: completed ? null : nextContest,
        endContest,
        completed,
      };
    } catch (error) {
      await this.prisma.importRun.update({
        where: { id: run.id },
        data: { status: "FAILED", finishedAt: new Date() },
      });
      throw new BadGatewayException(
        error instanceof Error ? error.message : "Falha na importação CAIXA",
      );
    }
  }

  async dataHealth(slug: LotterySlug) {
    const lottery = await this.prisma.lottery.findUnique({
      where: { slug },
    });
    const contests = await this.prisma.draw.findMany({
      where: {
        lottery: { slug },
        canonicalRevisionId: { not: null },
      },
      orderBy: { contestNumber: "asc" },
      select: { contestNumber: true, drawDate: true },
    });
    const gaps: Array<{ after: number; before: number }> = [];
    for (let index = 1; index < contests.length; index++) {
      if (contests[index].contestNumber !== contests[index - 1].contestNumber + 1) {
        gaps.push({
          after: contests[index - 1].contestNumber,
          before: contests[index].contestNumber,
        });
      }
    }
    const lastFetch = await this.prisma.sourceFetch.findFirst({
      where: { lotterySlug: slug },
      orderBy: { fetchedAt: "desc" },
    });
    return {
      lottery: slug,
      confirmedDraws: contests.length,
      firstContest: contests[0]?.contestNumber ?? null,
      lastContest: contests.at(-1)?.contestNumber ?? null,
      lastDrawDate: contests.at(-1)?.drawDate ?? null,
      nextContestNumber: lottery?.nextContestNumber ?? null,
      nextDrawDate: lottery?.nextDrawDate ?? null,
      estimatedPrizeCents: lottery?.estimatedPrizeCents?.toString() ?? null,
      sourceLatestContest: lottery?.sourceLatestContest ?? null,
      gaps,
      complete:
        contests.length > 0 &&
        contests[0].contestNumber === 1 &&
        gaps.length === 0 &&
        lottery?.sourceLatestContest === contests.at(-1)?.contestNumber,
      lastFetch: lastFetch
        ? {
            fetchedAt: lastFetch.fetchedAt,
            url: lastFetch.url,
            statusCode: lastFetch.statusCode,
            error: lastFetch.error,
          }
        : null,
    };
  }

  async latestDraw(slug: LotterySlug) {
    const lottery = await this.prisma.lottery.findUnique({
      where: { slug },
    });
    if (!lottery) {
      return {
        lottery: slug,
        state: "NO_RESULTS",
        draw: null,
        coverage: null,
        lastVerification: null,
      };
    }
    const draw = await this.prisma.draw.findFirst({
      where: {
        lotteryId: lottery.id,
        canonicalRevisionId: { not: null },
      },
      orderBy: { contestNumber: "desc" },
      include: {
        revisions: { include: { prizeTiers: true } },
      },
    });
    const lastVerification = await this.prisma.sourceFetch.findFirst({
      where: { lotterySlug: slug },
      orderBy: { fetchedAt: "desc" },
    });
    if (!draw?.canonicalRevisionId) {
      return {
        lottery: slug,
        state: "NO_RESULTS",
        draw: null,
        coverage: lottery.dataCoverage,
        lastVerification,
      };
    }
    const revision = draw.revisions.find(
      (candidate) => candidate.id === draw.canonicalRevisionId,
    )!;
    return {
      lottery: slug,
      state: lottery.freshnessStatus,
      sourceLatestContest: lottery.sourceLatestContest,
      draw: {
        contestNumber: draw.contestNumber,
        drawDate: draw.drawDate.toISOString().slice(0, 10),
        numbers: revision.numbers,
        originalOrder: revision.originalOrder,
        luckyMonth: revision.luckyMonth,
        accumulated: revision.accumulated,
        prizeState: revision.prizeState,
        prizeTiers: revision.prizeTiers.map((tier) => ({
          label: tier.label,
          hits: tier.hits,
          luckyMonthRequired: tier.luckyMonthRequired,
          winners: tier.winners,
          amountCents: tier.amountCents?.toString() ?? null,
        })),
        sourceUrl: revision.sourceUrl,
        fetchedAt: revision.fetchedAt,
        sourceVerifiedAt: revision.sourceVerifiedAt,
      },
      nextContest: {
        contestNumber: lottery.nextContestNumber,
        drawDate: lottery.nextDrawDate?.toISOString().slice(0, 10) ?? null,
        estimatedPrizeCents:
          lottery.estimatedPrizeCents?.toString() ?? null,
      },
      coverage: lottery.dataCoverage,
      lastVerification: lastVerification
        ? {
            fetchedAt: lastVerification.fetchedAt,
            statusCode: lastVerification.statusCode,
            error: lastVerification.error,
          }
        : null,
    };
  }

  async recalculateAnalysisOnly(slug: LotterySlug) {
    const dataset = await this.dataset(slug);
    if (dataset.draws.length < 2) {
      throw new BadRequestException("São necessários pelo menos dois concursos");
    }
    const analysis = await this.analytics("/v1/analyze", {
      dataset,
      windows: [10, 25, 50, 100, 250],
    });
    const lottery = await this.prisma.lottery.findUniqueOrThrow({
      where: { slug },
    });
    const snapshot = await this.prisma.analysisSnapshot.upsert({
      where: {
        lotteryId_cutoffContest_datasetHash_version: {
          lotteryId: lottery.id,
          cutoffContest: dataset.contest_numbers.at(-1)!,
          datasetHash: dataset.dataset_hash,
          version: "descriptive-v1",
        },
      },
      update: {
        status: "PUBLISHED",
        windows: [10, 25, 50, 100, 250],
        metadata: analysis as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
      create: {
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
    return snapshot.id;
  }

  async recalculate(slug: LotterySlug) {
    const dataset = await this.dataset(slug);
    if (dataset.draws.length < 2) {
      throw new BadRequestException("São necessários pelo menos dois concursos");
    }
    const lotteryState = await this.prisma.lottery.findUniqueOrThrow({
      where: { slug },
      select: { freshnessStatus: true },
    });
    if (lotteryState.freshnessStatus !== "VERIFIED") {
      throw new BadRequestException(
        "Publicação automática exige base atual verificada",
      );
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
      window: 50,
      alpha: 10,
      tau: 1,
    })) as AnalyticsGeneration;
    const monthSeed =
      slug === "dia-de-sorte"
        ? createHash("sha256")
            .update(`${generation.seed}:lucky-month-v1`)
            .digest("hex")
        : null;
    const result = await this.prisma.$transaction(async (tx) => {
      const lottery = await tx.lottery.findUniqueOrThrow({ where: { slug } });
      const previous = await tx.suggestionBatch.findFirst({
        where: { userId: null, snapshot: { lotteryId: lottery.id } },
        orderBy: { createdAt: "desc" },
      });
      const snapshot = await tx.analysisSnapshot.upsert({
        where: {
          lotteryId_cutoffContest_datasetHash_version: {
            lotteryId: lottery.id,
            cutoffContest: dataset.contest_numbers.at(-1)!,
            datasetHash: dataset.dataset_hash,
            version: "descriptive-v1",
          },
        },
        update: {
          status: "PUBLISHED",
          windows: [10, 25, 50, 100, 250],
          metadata: analysis as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
        create: {
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
          strategyId_version: { strategyId: strategy.id, version: "2.0.0" },
        },
        update: {},
        create: {
          strategyId: strategy.id,
          version: "2.0.0",
          parameters: {
            window: 50,
            alpha: 10,
            tau: 1,
            weightedWithoutReplacement: true,
          },
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
          constraints: monthSeed
            ? {
                luckyMonth: {
                  strategy: "uniform-random-reference",
                  seed: monthSeed,
                  prng: "sha256-counter-v1",
                },
              }
            : {},
          datasetHash: dataset.dataset_hash,
          scoreVersion: generation.score_version ?? "none",
          status: "PUBLISHED",
          previousBatchId: previous?.id,
          publishedAt: new Date(),
          games: {
            create: generation.games.map((game, index) => ({
              numbers: game.numbers,
              luckyMonth: monthSeed
                ? generateLuckyMonth(monthSeed, index)
                : null,
              score: game.score,
              scoreBreakdown: {
                ...game.explanation,
                ...(monthSeed
                  ? {
                      lucky_month: {
                        value: generateLuckyMonth(monthSeed, index),
                        strategy: "uniform-random-reference",
                        seed: monthSeed,
                        prng: "sha256-counter-v1",
                        notice:
                          "Referência uniforme 1/12; não altera o score das dezenas.",
                      },
                    }
                  : {}),
              } as Prisma.InputJsonValue,
            })),
          },
        },
      });
      return { snapshot, batch };
    });
    return { snapshotId: result.snapshot.id, batchId: result.batch.id };
  }

  async generationOptions(slug: LotterySlug) {
    const dataset = await this.dataset(slug);
    const lottery = await this.prisma.lottery.findUnique({ where: { slug } });
    const first = dataset.contest_numbers[0] ?? null;
    const last = dataset.contest_numbers.at(-1) ?? null;
    return {
      lottery: slug,
      sample: { n: dataset.draws.length, firstContest: first, lastContest: last },
      freshnessStatus: lottery?.freshnessStatus ?? "NO_RESULTS",
      strategies: [
        {
          id: "uniform",
          label: "Aleatório — sem análise histórica",
          minimumSample: 0,
          available: true,
          hasScore: false,
        },
        {
          id: "recent-frequency",
          label: "Frequência histórica recente",
          minimumSample: 10,
          available: dataset.draws.length >= 10,
          hasScore: false,
        },
        {
          id: "historical-profile",
          label: "Perfil histórico",
          minimumSample: 25,
          available: dataset.draws.length >= 25,
          hasScore: true,
        },
        {
          id: "diversified",
          label: "Carteira diversificada",
          minimumSample: 10,
          available: dataset.draws.length >= 10,
          hasScore: false,
        },
      ],
    };
  }

  async latestAnalysis(slug: LotterySlug, window = 50) {
    const snapshot = await this.prisma.analysisSnapshot.findFirst({
      where: { lottery: { slug }, status: "PUBLISHED" },
      orderBy: [{ cutoffContest: "desc" }, { createdAt: "desc" }],
    });
    if (!snapshot) return null;
    const metadata = snapshot.metadata as {
      formula_version?: string;
      windows?: Record<
        string,
        {
          n: number;
          numbers: Array<{
            number: number;
            count: number;
            frequency: number;
            expected: number;
            ema: number;
            gap: number | null;
          }>;
          sum?: { mean: number | null; p05: number | null; p95: number | null };
          odd?: { mean: number | null };
        }
      >;
    };
    const available = Object.keys(metadata.windows ?? {}).map(Number);
    const selectedWindow = available.includes(window)
      ? window
      : available.sort((a, b) => Math.abs(a - window) - Math.abs(b - window))[0];
    return {
      lottery: slug,
      cutoffContest: snapshot.cutoffContest,
      formulaVersion: metadata.formula_version,
      requestedWindow: window,
      selectedWindow,
      data: selectedWindow
        ? metadata.windows?.[String(selectedWindow)]
        : null,
    };
  }

  async generateForUser(
    userId: string,
    input: {
      lottery: LotterySlug;
      strategy:
        | "uniform"
        | "recent-frequency"
        | "historical-profile"
        | "diversified";
      count: number;
      window?: number;
      alpha?: number;
      tau?: number;
      fixed?: number[];
      excluded?: number[];
      maxOverlap?: number;
      baseStrategy?: "uniform" | "recent-frequency" | "historical-profile";
      allowStaleSimulation?: boolean;
      seed?: number;
      requestKey?: string;
    },
  ) {
    const rules = RULES[input.lottery];
    if (
      !["uniform", "recent-frequency", "historical-profile", "diversified"].includes(
        input.strategy,
      )
    ) {
      throw new BadRequestException("Estratégia inválida");
    }
    if (!Number.isInteger(input.count) || input.count < 1 || input.count > 20) {
      throw new BadRequestException("Quantidade deve estar entre 1 e 20");
    }
    const window = input.window ?? 50;
    const alpha = input.alpha ?? 10;
    const tau = input.tau ?? 1;
    if (
      !Number.isInteger(window) ||
      window < 1 ||
      window > 500 ||
      !Number.isFinite(alpha) ||
      alpha <= 0 ||
      alpha > 100 ||
      !Number.isFinite(tau) ||
      tau < 0 ||
      tau > 3 ||
      (input.seed !== undefined &&
        (!Number.isInteger(input.seed) ||
          input.seed < 0 ||
          input.seed > 2_147_483_647))
    ) {
      throw new BadRequestException("Parâmetros da estratégia inválidos");
    }
    const fixed = input.fixed ?? [];
    const excluded = input.excluded ?? [];
    if (
      new Set(fixed).size !== fixed.length ||
      new Set(excluded).size !== excluded.length ||
      fixed.some((number) => excluded.includes(number)) ||
      [...fixed, ...excluded].some(
        (number) =>
          !Number.isInteger(number) ||
          number < 1 ||
          number > rules.universe,
      ) ||
      fixed.length > rules.simplePick ||
      rules.universe - excluded.length < rules.simplePick
    ) {
      throw new BadRequestException("Restrições de dezenas são inviáveis");
    }
    const dataset = await this.dataset(input.lottery);
    const lottery = await this.prisma.lottery.upsert({
      where: { slug: input.lottery },
      update: {},
      create: { slug: input.lottery, name: input.lottery },
    });
    const historical =
      input.strategy !== "uniform" &&
      !(
        input.strategy === "diversified" &&
        input.baseStrategy === "uniform"
      );
    const minimum =
      input.strategy === "historical-profile" ||
      (input.strategy === "diversified" &&
        input.baseStrategy === "historical-profile")
        ? 25
        : historical
          ? 10
          : 0;
    if (dataset.draws.length < minimum) {
      throw new BadRequestException(
        `Histórico insuficiente: disponível ${dataset.draws.length}, necessário ${minimum}`,
      );
    }
    const stale = lottery.freshnessStatus !== "VERIFIED";
    if (historical && stale && !input.allowStaleSimulation) {
      throw new BadRequestException(
        "A base não está verificada como atual; habilite simulação com corte explícito",
      );
    }
    if (input.requestKey) {
      const existing = await this.prisma.withUser(userId, (tx) =>
        tx.suggestionBatch.findUnique({
          where: {
            userId_requestKey: {
              userId,
              requestKey: input.requestKey!,
            },
          },
          include: {
            games: true,
            snapshot: true,
            strategyVersion: { include: { strategy: true } },
          },
        }),
      );
      if (existing) return existing;
    }
    await this.consumeGenerationQuota(userId, input.count);
    const seed = input.seed ?? randomInt(1, 2_147_483_647);
    const generation = (await this.analytics("/v1/generate", {
      dataset,
      strategy: input.strategy,
      count: input.count,
      pick_count: rules.simplePick,
      seed,
      fixed,
      excluded,
      max_overlap: input.maxOverlap,
      window,
      alpha,
      tau,
      reference_size: 2000,
      base_strategy: input.baseStrategy ?? "recent-frequency",
    })) as AnalyticsGeneration;
    let snapshotId: string;
    if (dataset.draws.length >= 2) {
      snapshotId = await this.recalculateAnalysisOnly(input.lottery);
    } else {
      const snapshot = await this.prisma.analysisSnapshot.upsert({
        where: {
          lotteryId_cutoffContest_datasetHash_version: {
            lotteryId: lottery.id,
            cutoffContest: dataset.contest_numbers.at(-1) ?? 0,
            datasetHash: dataset.dataset_hash,
            version: "baseline-empty-v1",
          },
        },
        update: {},
        create: {
          lotteryId: lottery.id,
          cutoffContest: dataset.contest_numbers.at(-1) ?? 0,
          datasetHash: dataset.dataset_hash,
          version: "baseline-empty-v1",
          status: "PUBLISHED",
          windows: [],
          metadata: {
            notice: "Baseline uniforme sem análise histórica.",
          },
          publishedAt: new Date(),
        },
      });
      snapshotId = snapshot.id;
    }
    const monthSeed =
      input.lottery === "dia-de-sorte"
        ? createHash("sha256")
            .update(`${generation.seed}:lucky-month-v1`)
            .digest("hex")
        : null;
    const batch = await this.prisma.withUser(userId, async (tx) => {
      const strategy = await tx.strategy.upsert({
        where: {
          lotteryId_code: {
            lotteryId: lottery.id,
            code: generation.strategy,
          },
        },
        update: {},
        create: {
          lotteryId: lottery.id,
          code: generation.strategy,
          name:
            input.strategy === "uniform"
              ? "Aleatório — sem análise histórica"
              : input.strategy === "recent-frequency"
                ? "Frequência histórica recente"
                : input.strategy === "historical-profile"
                  ? "Perfil histórico"
                  : "Carteira diversificada",
        },
      });
      const strategyVersion = await tx.strategyVersion.upsert({
        where: {
          strategyId_version: {
            strategyId: strategy.id,
            version: generation.strategy_version,
          },
        },
        update: {},
        create: {
          strategyId: strategy.id,
          version: generation.strategy_version,
          parameters: {
            window,
            alpha,
            tau,
            baseStrategy: input.baseStrategy ?? null,
            ...(generation.parameters ?? {}),
          },
          status: "ACTIVE",
        },
      });
      const previous = await tx.suggestionBatch.findFirst({
        where: { userId, snapshot: { lotteryId: lottery.id } },
        orderBy: { createdAt: "desc" },
      });
      return tx.suggestionBatch.create({
        data: {
          snapshotId,
          strategyVersionId: strategyVersion.id,
          userId,
          targetContest:
            lottery.nextContestNumber ??
            (dataset.contest_numbers.at(-1) ?? 0) + 1,
          seed: String(generation.seed),
          prng: generation.prng,
          constraints: {
            fixed,
            excluded,
            maxOverlap: input.maxOverlap ?? null,
            simulation: historical && stale,
            sample: generation.sample,
            ...(monthSeed
              ? {
                  luckyMonth: {
                    strategy: "uniform-random-reference",
                    seed: monthSeed,
                    prng: "sha256-counter-v1",
                  },
                }
              : {}),
          },
          datasetHash: dataset.dataset_hash,
          scoreVersion: generation.score_version ?? "none",
          status: historical && stale ? "SIMULATION" : "PUBLISHED",
          requestKey: input.requestKey,
          previousBatchId: previous?.id,
          publishedAt: new Date(),
          games: {
            create: generation.games.map((game, index) => ({
              numbers: game.numbers,
              luckyMonth: monthSeed
                ? generateLuckyMonth(monthSeed, index)
                : null,
              score: game.score,
              scoreBreakdown: {
                ...game.explanation,
                ...(monthSeed
                  ? {
                      lucky_month: {
                        value: generateLuckyMonth(monthSeed, index),
                        strategy: "uniform-random-reference",
                        seed: monthSeed,
                        notice:
                          "Referência uniforme 1/12; independente das dezenas.",
                      },
                    }
                  : {}),
              } as Prisma.InputJsonValue,
            })),
          },
        },
        include: {
          games: true,
          snapshot: true,
          strategyVersion: { include: { strategy: true } },
        },
      });
    });
    return batch;
  }

  async latest(slug: LotterySlug) {
    const lottery = await this.prisma.lottery.findUnique({ where: { slug } });
    if (!lottery) throw new NotFoundException("Modalidade sem dados");
    return this.prisma.suggestionBatch.findFirst({
      where: { snapshot: { lotteryId: lottery.id }, userId: null },
      orderBy: { createdAt: "desc" },
      include: {
        games: true,
        snapshot: true,
        strategyVersion: { include: { strategy: true } },
      },
    });
  }

  async saveGame(userId: string, suggestedGameId: string, name?: string) {
    return this.prisma.withUser(userId, (tx) =>
      tx.suggestedGame
        .findUnique({
          where: { id: suggestedGameId },
          include: {
            batch: {
              include: { snapshot: { include: { lottery: true } } },
            },
          },
        })
        .then((suggestion) => {
          if (!suggestion) {
            throw new NotFoundException("Sugestão não encontrada");
          }
          return tx.savedGame.create({
            data: {
              userId,
              suggestedGameId,
              lotterySlug: suggestion.batch.snapshot.lottery.slug,
              numbers: suggestion.numbers,
              luckyMonth: suggestion.luckyMonth,
              name: name ?? "Jogo salvo",
              tags: [],
            },
          });
        }),
    );
  }

  async userGames(userId: string) {
    return this.prisma.withUser(userId, (tx) =>
      tx.savedGame.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          tracking: true,
          evaluations: {
            include: { drawRevision: { include: { draw: true } } },
          },
        },
      }),
    );
  }

  async archiveGame(userId: string, gameId: string, archived: boolean) {
    return this.prisma.withUser(userId, async (tx) => {
      const result = await tx.savedGame.updateMany({
        where: { id: gameId, userId },
        data: { archivedAt: archived ? new Date() : null },
      });
      if (result.count !== 1) {
        throw new NotFoundException("Jogo não encontrado");
      }
      return tx.savedGame.findUniqueOrThrow({ where: { id: gameId } });
    });
  }

  async trackGame(
    userId: string,
    gameId: string,
    startContest: number,
    endContest?: number,
  ) {
    if (
      !Number.isInteger(startContest) ||
      startContest < 1 ||
      (endContest !== undefined &&
        (!Number.isInteger(endContest) || endContest < startContest))
    ) {
      throw new BadRequestException("Intervalo de acompanhamento inválido");
    }
    return this.prisma.withUser(userId, async (tx) => {
      const game = await tx.savedGame.findFirst({
        where: { id: gameId, userId },
      });
      if (!game) throw new NotFoundException("Jogo não encontrado");
      return tx.trackingSubscription.create({
        data: { savedGameId: gameId, startContest, endContest },
      });
    });
  }

  async evaluateContest(slug: LotterySlug, contestNumber: number) {
    const lottery = await this.prisma.lottery.findUniqueOrThrow({
      where: { slug },
    });
    const draw = await this.prisma.draw.findUnique({
      where: {
        lotteryId_contestNumber: {
          lotteryId: lottery.id,
          contestNumber,
        },
      },
      include: { revisions: true },
    });
    if (!draw?.canonicalRevisionId) {
      throw new NotFoundException("Concurso confirmado não encontrado");
    }
    const revision = draw.revisions.find(
      (candidate) => candidate.id === draw.canonicalRevisionId,
    )!;
    await this.evaluateGames(
      slug,
      revision.id,
      revision.numbers,
      revision.luckyMonth,
    );
    return { contestNumber, revisionId: revision.id, evaluated: true };
  }

  async backtest(
    slug: LotterySlug,
    options: {
      ticketsPerContest?: number;
      seeds?: number[];
      minTraining?: number;
      strategy?: "uniform" | "recent-frequency";
    } = {},
  ) {
    const dataset = await this.dataset(slug);
    const minTraining = options.minTraining ?? 25;
    if (dataset.draws.length <= minTraining) {
      throw new BadRequestException(
        `Backtest exige mais de ${minTraining} concursos confirmados`,
      );
    }
    return this.analytics("/v1/backtest", {
      dataset,
      strategy: options.strategy ?? "recent-frequency",
      tickets_per_contest: options.ticketsPerContest ?? 5,
      pick_count: RULES[slug].simplePick,
      seeds: options.seeds ?? [1, 2, 3, 4, 5],
      min_training: minTraining,
    });
  }

  private assertCaixaEnabled() {
    if (process.env.CAIXA_ENABLED !== "true") {
      throw new BadGatewayException(
        "Sincronização CAIXA desativada; configure CAIXA_ENABLED=true",
      );
    }
  }

  private async consumeGenerationQuota(userId: string, amount: number) {
    const period = new Date().toISOString().slice(0, 10);
    const limit = Math.max(
      1,
      Number(process.env.DEFAULT_DAILY_GAME_LIMIT ?? 100),
    );
    await this.prisma.withUser(userId, async (tx) => {
      const counter = await tx.usageCounter.upsert({
        where: {
          userId_key_period: {
            userId,
            key: "generated-games",
            period,
          },
        },
        update: { limit },
        create: {
          userId,
          key: "generated-games",
          period,
          used: 0,
          limit,
        },
      });
      const consumed = await tx.usageCounter.updateMany({
        where: {
          id: counter.id,
          used: { lte: limit - amount },
        },
        data: { used: { increment: amount } },
      });
      if (consumed.count !== 1) {
        throw new ForbiddenException(
          `Limite diário de ${limit} jogos atingido`,
        );
      }
    });
  }

  private async recordSourceFetch(
    slug: LotterySlug,
    fetched: CaixaFetchResult,
  ) {
    await this.prisma.sourceFetch.create({
      data: {
        lotterySlug: slug,
        url: fetched.url,
        fetchedAt: fetched.fetchedAt,
        statusCode: 200,
        payloadHash: fetched.payloadHash,
        rawPayload: fetched.raw as Prisma.InputJsonValue,
        parserVersion: fetched.input.parserVersion,
      },
    });
  }

  private async recordSourceFailure(
    slug: LotterySlug,
    contest: number | undefined,
    error: unknown,
  ) {
    await this.prisma.$transaction([
      this.prisma.sourceFetch.create({
        data: {
          lotterySlug: slug,
          url: this.caixa.endpointUrl(slug, contest),
          fetchedAt: new Date(),
          statusCode:
            typeof (error as { statusCode?: unknown })?.statusCode === "number"
              ? (error as { statusCode: number }).statusCode
              : null,
          parserVersion: "caixa-portal-servicebus-v2",
          error: error instanceof Error ? error.message : String(error),
        },
      }),
      this.prisma.lottery.updateMany({
        where: { slug },
        data: { freshnessStatus: "VERIFICATION_UNAVAILABLE" },
      }),
    ]);
  }

  private async updateCoverage(slug: LotterySlug) {
    const lottery = await this.prisma.lottery.findUniqueOrThrow({
      where: { slug },
    });
    const draws = await this.prisma.draw.findMany({
      where: {
        lotteryId: lottery.id,
        canonicalRevisionId: { not: null },
      },
      orderBy: { contestNumber: "asc" },
      include: { revisions: true },
    });
    const gaps: Array<{ after: number; before: number }> = [];
    for (let index = 1; index < draws.length; index++) {
      if (draws[index].contestNumber !== draws[index - 1].contestNumber + 1) {
        gaps.push({
          after: draws[index - 1].contestNumber,
          before: draws[index].contestNumber,
        });
      }
    }
    const firstContest = draws[0]?.contestNumber ?? null;
    const lastContest = draws.at(-1)?.contestNumber ?? null;
    const canonical = draws.at(-1)?.revisions.find(
      (revision) => revision.id === draws.at(-1)?.canonicalRevisionId,
    );
    const complete =
      firstContest === 1 &&
      gaps.length === 0 &&
      lottery.sourceLatestContest !== null &&
      lottery.sourceLatestContest === lastContest;
    const freshnessStatus =
      lastContest === null
        ? "NO_RESULTS"
        : lottery.sourceLatestContest === lastContest &&
            canonical?.sourceVerifiedAt
          ? "VERIFIED"
          : lottery.sourceLatestContest &&
              lastContest < lottery.sourceLatestContest
            ? "BEHIND_SOURCE"
            : "UNVERIFIED";
    await this.prisma.lottery.update({
      where: { id: lottery.id },
      data: {
        freshnessStatus,
        dataCoverage: {
          confirmedDraws: draws.length,
          firstContest,
          lastContest,
          sourceLatestContest: lottery.sourceLatestContest,
          gaps,
          complete,
        },
      },
    });
  }

  private async applyOfficialMetadata(
    revisionId: string,
    slug: LotterySlug,
    options: ImportOptions,
  ) {
    if (
      options.prizes === undefined &&
      options.nextPublication === undefined &&
      options.sourceLatestContest === undefined &&
      options.sourceVerifiedAt === undefined &&
      options.accumulated === undefined
    ) {
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      if (options.prizes !== undefined && options.prizes !== null) {
        await tx.prizeTier.deleteMany({ where: { drawRevisionId: revisionId } });
        await tx.prizeTier.createMany({
          data: options.prizes.map((tier) => ({
            drawRevisionId: revisionId,
            label: tier.label,
            hits: tier.hits,
            luckyMonthRequired: tier.luckyMonthRequired,
            winners: tier.winners,
            amountCents: tier.amountCents,
          })),
        });
        await tx.drawRevision.update({
          where: { id: revisionId },
          data: { prizeState: PrizeState.CONFIRMED },
        });
      }
      if (
        options.sourceVerifiedAt !== undefined ||
        options.accumulated !== undefined
      ) {
        await tx.drawRevision.update({
          where: { id: revisionId },
          data: {
            sourceVerifiedAt: options.sourceVerifiedAt,
            accumulated: options.accumulated,
          },
        });
      }
      if (options.nextPublication) {
        await tx.lottery.update({
          where: { slug },
          data: {
            sourceLatestContest: options.sourceLatestContest,
            nextContestNumber: options.nextPublication.contestNumber,
            nextDrawDate: options.nextPublication.drawDate
              ? new Date(`${options.nextPublication.drawDate}T00:00:00.000Z`)
              : null,
            estimatedPrizeCents:
              options.nextPublication.estimatedPrizeCents,
            sourceUpdatedAt: options.sourceUpdatedAt ?? new Date(),
          },
        });
      }
    });
  }

  private async updateLotteryPublication(
    slug: LotterySlug,
    fetched: CaixaFetchResult,
  ) {
    await this.prisma.lottery.upsert({
      where: { slug },
      update: {
        sourceLatestContest: fetched.input.contestNumber,
        nextContestNumber: fetched.nextContest.contestNumber,
        nextDrawDate: fetched.nextContest.drawDate
          ? new Date(`${fetched.nextContest.drawDate}T00:00:00.000Z`)
          : null,
        estimatedPrizeCents: fetched.nextContest.estimatedPrizeCents,
        sourceUpdatedAt: fetched.fetchedAt,
      },
      create: {
        slug,
        name: slug,
        sourceLatestContest: fetched.input.contestNumber,
        nextContestNumber: fetched.nextContest.contestNumber,
        nextDrawDate: fetched.nextContest.drawDate
          ? new Date(`${fetched.nextContest.drawDate}T00:00:00.000Z`)
          : null,
        estimatedPrizeCents: fetched.nextContest.estimatedPrizeCents,
        sourceUpdatedAt: fetched.fetchedAt,
      },
    });
  }

  private async completeJob(
    id: string,
    checkpoint: Record<string, unknown>,
  ) {
    await this.prisma.jobRun.update({
      where: { id },
      data: {
        status: "COMPLETED",
        checkpoint: checkpoint as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
  }

  private async evaluateGames(
    slug: LotterySlug,
    revisionId: string,
    numbers: number[],
    month?: number | null,
  ) {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      await this.prisma.withUser(user.id, async (tx) => {
        const games = await tx.savedGame.findMany({
          where: { userId: user.id, lotterySlug: slug },
        });
        for (const game of games) {
          await tx.gameEvaluation.upsert({
            where: {
              savedGameId_drawRevisionId: {
                savedGameId: game.id,
                drawRevisionId: revisionId,
              },
            },
            update: {
              numberHits: game.numbers.filter((number) =>
                numbers.includes(number),
              ).length,
              luckyMonthHit:
                slug === "dia-de-sorte" ? game.luckyMonth === month : null,
            },
            create: {
              savedGameId: game.id,
              drawRevisionId: revisionId,
              numberHits: game.numbers.filter((number) =>
                numbers.includes(number),
              ).length,
              luckyMonthHit:
                slug === "dia-de-sorte" ? game.luckyMonth === month : null,
              mode: "FUTURE_TRACKING",
            },
          });
        }
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
