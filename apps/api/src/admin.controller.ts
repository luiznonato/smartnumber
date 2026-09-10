import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { AdminService } from "./admin.service.js";
import { AuthService } from "./auth.service.js";

@Controller("admin")
export class AdminController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AdminService) private readonly admin: AdminService,
  ) {}

  @Get("overview")
  async overview(@Req() request: FastifyRequest) {
    await this.auth.authenticate(request, Role.ADMIN);
    return this.admin.overview();
  }

  @Get("users")
  async users(@Req() request: FastifyRequest) {
    await this.auth.authenticate(request, Role.ADMIN);
    return this.admin.users();
  }

  @Post("users/:id/suspension")
  async suspend(
    @Req() request: FastifyRequest,
    @Param("id") id: string,
    @Body() body: { suspended?: boolean },
  ) {
    const session = await this.auth.authenticate(request, Role.ADMIN);
    return this.admin.suspendUser(
      session.user.id,
      id,
      body.suspended !== false,
    );
  }

  @Get("plans")
  async plans(@Req() request: FastifyRequest) {
    await this.auth.authenticate(request, Role.ADMIN);
    return this.admin.plans();
  }

  @Post("plans")
  async upsertPlan(
    @Req() request: FastifyRequest,
    @Body()
    body: { code: string; name: string; limits: Record<string, unknown> },
  ) {
    const session = await this.auth.authenticate(request, Role.ADMIN);
    return this.admin.upsertPlan(session.user.id, body);
  }
}
