import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { lotterySlugSchema } from "@atlas/contracts";
import { AuthService } from "./auth.service.js";
import { LotteryFlowService } from "./lottery-flow.service.js";

@Controller("admin/draws")
export class AdminDrawController {
  constructor(
    private readonly auth: AuthService,
    private readonly flow: LotteryFlowService,
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
}

@Controller("suggestions")
export class SuggestionController {
  constructor(private readonly flow: LotteryFlowService) {}

  @Get(":lottery/latest")
  latest(@Param("lottery") lottery: string) {
    return this.flow.latest(lotterySlugSchema.parse(lottery));
  }
}

@Controller("saved-games")
export class SavedGameController {
  constructor(
    private readonly auth: AuthService,
    private readonly flow: LotteryFlowService,
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
}
