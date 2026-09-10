import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
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
  constructor(private readonly auth: AuthService) {}

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
}

@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  async login(
    @Body() body: Credentials,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.login(body.email, body.password, Role.ADMIN);
    setSessionCookie(reply, result);
    return { user: result.user };
  }

  @Get("me")
  async me(@Req() request: FastifyRequest) {
    return (await this.auth.authenticate(request, Role.ADMIN)).user;
  }
}
