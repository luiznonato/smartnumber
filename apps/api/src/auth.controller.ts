import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service.js";

type Credentials = { email: string; password: string };

function setSessionCookie(
  reply: FastifyReply,
  session: { token: string; expiresAt: Date },
) {
  reply.setCookie("atlas_session", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: session.expiresAt,
  });
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("register")
  async register(
    @Body() body: Credentials,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.register(body.email, body.password);
    setSessionCookie(reply, result);
    return { user: result.user };
  }

  @Post("login")
  async login(
    @Body() body: Credentials,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.login(body.email, body.password);
    setSessionCookie(reply, result);
    return { user: result.user };
  }

  @Get("me")
  async me(@Req() request: FastifyRequest) {
    return (await this.auth.authenticate(request)).user;
  }

  @Post("logout")
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logout(request);
    reply.clearCookie("atlas_session", { path: "/" });
    return { ok: true };
  }

  @Post("email-verification/request")
  async requestVerification(@Req() request: FastifyRequest) {
    const session = await this.auth.authenticate(request);
    return this.auth.requestEmailVerification(session.user.id);
  }

  @Post("email-verification/confirm")
  verifyEmail(@Body() body: { token: string }) {
    return this.auth.verifyEmail(body.token);
  }

  @Post("password-reset/request")
  requestPasswordReset(@Body() body: { email: string }) {
    return this.auth.requestPasswordReset(body.email);
  }

  @Post("password-reset/confirm")
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Get("sessions")
  async sessions(@Req() request: FastifyRequest) {
    const session = await this.auth.authenticate(request);
    return this.auth.sessions(session.user.id);
  }

  @Post("sessions/:id/revoke")
  async revokeSession(
    @Req() request: FastifyRequest,
    @Param("id") id: string,
  ) {
    const session = await this.auth.authenticate(request);
    return this.auth.revokeSession(session.user.id, id);
  }
}

@Controller("admin/auth")
export class AdminAuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("login")
  async login(
    @Body() body: Credentials,
  ) {
    return this.auth.beginAdminLogin(body.email, body.password);
  }

  @Post("mfa/setup")
  async setupMfa(
    @Body() body: { challenge: string; code: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.completeAdminMfa(
      body.challenge,
      body.code,
      true,
    );
    setSessionCookie(reply, result);
    return { user: result.user, recoveryCodes: result.recoveryCodes };
  }

  @Post("mfa/verify")
  async verifyMfa(
    @Body() body: { challenge: string; code: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.completeAdminMfa(
      body.challenge,
      body.code,
      false,
    );
    setSessionCookie(reply, result);
    return { user: result.user };
  }

  @Get("me")
  async me(@Req() request: FastifyRequest) {
    return (await this.auth.authenticate(request, Role.ADMIN)).user;
  }
}
