import { Body, Controller, Inject, Param, Post, Req } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { AdminImportService } from "./admin-import.service.js";
import { AuthService } from "./auth.service.js";

@Controller("admin/imports")
export class AdminImportController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AdminImportService) private readonly imports: AdminImportService,
  ) {}

  @Post("preview")
  async preview(
    @Req() request: FastifyRequest,
    @Body()
    body: {
      lottery: string;
      fileName: string;
      content: string;
      format: "json" | "csv";
      sourceUrl: string;
      delimiter?: string;
      mapping?: {
        contestNumber: string;
        drawDate: string;
        numbers: string;
        luckyMonth?: string;
        originalOrder?: string;
      };
    },
  ) {
    const session = await this.auth.authenticate(request, Role.ADMIN);
    return this.imports.preview(session.user.id, body);
  }

  @Post(":id/confirm")
  async confirm(
    @Req() request: FastifyRequest,
    @Param("id") id: string,
  ) {
    const session = await this.auth.authenticate(request, Role.ADMIN);
    return this.imports.confirm(session.user.id, id);
  }
}
