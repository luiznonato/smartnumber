import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { lotterySlugSchema } from "@atlas/contracts";
import { AuthService } from "./auth.service.js";
import { LotteryFlowService } from "./lottery-flow.service.js";

@Controller("admin/draws")
export class AdminDrawController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(LotteryFlowService) private readonly flow: LotteryFlowService,
  ) {}

  @Post("import")
  async import(@Req() request: FastifyRequest, @Body() body: unknown) {
    await this.auth.authenticate(request, Role.ADMIN);
    return this.flow.importConfirmed(body);
  }

  @Post(":lottery/recalculate")
  async recalculate(
    @Req() request: FastifyRequest,
    @Param("lottery") lottery: string,
  ) {
    await this.auth.authenticate(request, Role.ADMIN);
    return this.flow.recalculate(lotterySlugSchema.parse(lottery));
  }

  @Post(":lottery/sync-latest")
  async syncLatest(
    @Req() request: FastifyRequest,
    @Param("lottery") lottery: string,
  ) {
    await this.auth.authenticate(request, Role.ADMIN);
    return this.flow.syncLatest(lotterySlugSchema.parse(lottery));
  }

  @Post(":lottery/sync-history")
  async syncHistory(
    @Req() request: FastifyRequest,
    @Param("lottery") lottery: string,
    @Body()
    body: {
      startContest?: number;
      endContest?: number;
      limit?: number;
      resumeId?: string;
    },
  ) {
    await this.auth.authenticate(request, Role.ADMIN);
    return this.flow.syncHistoryBatch(
      lotterySlugSchema.parse(lottery),
      body,
    );
  }

  @Get(":lottery/health")
  async health(
    @Req() request: FastifyRequest,
    @Param("lottery") lottery: string,
  ) {
    await this.auth.authenticate(request, Role.ADMIN);
    return this.flow.dataHealth(lotterySlugSchema.parse(lottery));
  }
}

@Controller("suggestions")
export class SuggestionController {
  constructor(
    @Inject(LotteryFlowService) private readonly flow: LotteryFlowService,
  ) {}

  @Get(":lottery/latest")
  latest(@Param("lottery") lottery: string) {
    return this.flow.latest(lotterySlugSchema.parse(lottery));
  }
}

@Controller("draws")
export class DrawController {
  constructor(
    @Inject(LotteryFlowService) private readonly flow: LotteryFlowService,
  ) {}

  @Get(":lottery/latest")
  latest(@Param("lottery") lottery: string) {
    return this.flow.latestDraw(lotterySlugSchema.parse(lottery));
  }
}

@Controller("generation")
export class GenerationController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(LotteryFlowService) private readonly flow: LotteryFlowService,
  ) {}

  @Get(":lottery/options")
  async options(
    @Req() request: FastifyRequest,
    @Param("lottery") lottery: string,
  ) {
    await this.auth.authenticate(request);
    return this.flow.generationOptions(lotterySlugSchema.parse(lottery));
  }

  @Post()
  async generate(
    @Req() request: FastifyRequest,
    @Body()
    body: {
      lottery: string;
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
    const session = await this.auth.authenticate(request);
    return this.flow.generateForUser(session.user.id, {
      ...body,
      lottery: lotterySlugSchema.parse(body.lottery),
    });
  }
}

@Controller("analysis")
export class AnalysisController {
  constructor(
    @Inject(LotteryFlowService) private readonly flow: LotteryFlowService,
  ) {}

  @Get(":lottery/latest")
  latest(
    @Param("lottery") lottery: string,
    @Req() request: FastifyRequest,
  ) {
    const rawWindow = (request.query as { window?: string }).window;
    const window = Number(rawWindow ?? 50);
    return this.flow.latestAnalysis(
      lotterySlugSchema.parse(lottery),
      Number.isInteger(window) ? window : 50,
    );
  }
}

@Controller("saved-games")
export class SavedGameController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(LotteryFlowService) private readonly flow: LotteryFlowService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    const session = await this.auth.authenticate(request);
    return this.flow.userGames(session.user.id);
  }

  @Post()
  async save(
    @Req() request: FastifyRequest,
    @Body() body: { suggestedGameId: string; name?: string },
  ) {
    const session = await this.auth.authenticate(request);
    return this.flow.saveGame(session.user.id, body.suggestedGameId, body.name);
  }

  @Post(":id/archive")
  async archive(
    @Req() request: FastifyRequest,
    @Param("id") id: string,
    @Body() body: { archived?: boolean },
  ) {
    const session = await this.auth.authenticate(request);
    return this.flow.archiveGame(
      session.user.id,
      id,
      body.archived !== false,
    );
  }

  @Post(":id/track")
  async track(
    @Req() request: FastifyRequest,
    @Param("id") id: string,
    @Body() body: { startContest: number; endContest?: number },
  ) {
    const session = await this.auth.authenticate(request);
    return this.flow.trackGame(
      session.user.id,
      id,
      body.startContest,
      body.endContest,
    );
  }
}

@Controller("internal/draw-events")
export class InternalDrawEventController {
  constructor(
    @Inject(LotteryFlowService) private readonly flow: LotteryFlowService,
  ) {}

  @Post("process")
  process(
    @Headers("x-atlas-worker-secret") suppliedSecret: string | undefined,
    @Body() body: { revisionId?: string; publishAnalysis?: boolean },
  ) {
    const expectedSecret = process.env.WORKER_INTERNAL_SECRET;
    if (
      !expectedSecret ||
      expectedSecret.length < 32 ||
      suppliedSecret !== expectedSecret
    ) {
      throw new UnauthorizedException("Credencial interna inválida");
    }
    if (!body.revisionId) {
      throw new UnauthorizedException("Evento interno inválido");
    }
    return this.flow.processRevision(
      body.revisionId,
      body.publishAnalysis !== false,
    );
  }

  @Post("sync/:lottery")
  sync(
    @Headers("x-atlas-worker-secret") suppliedSecret: string | undefined,
    @Param("lottery") lottery: string,
  ) {
    const expectedSecret = process.env.WORKER_INTERNAL_SECRET;
    if (
      !expectedSecret ||
      expectedSecret.length < 32 ||
      suppliedSecret !== expectedSecret
    ) {
      throw new UnauthorizedException("Credencial interna inválida");
    }
    return this.flow.syncLatest(lotterySlugSchema.parse(lottery));
  }
}
