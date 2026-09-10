import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { hashPassword, issueSession, verifyPassword } from "./auth.js";
import { PrismaService } from "./database.js";

const SESSION_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    if (!email.includes("@")) throw new UnauthorizedException("E-mail inválido");
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException("E-mail já cadastrado");
    }
    const passwordHash = await hashPassword(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, preferences: { create: {} } },
      select: { id: true, email: true, role: true },
    });
    return { user, ...(await this.createSession(user.id)) };
  }

  async login(emailInput: string, password: string, requiredRole?: Role) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new UnauthorizedException("Credenciais inválidas");
    }
    if (requiredRole && user.role !== requiredRole) {
      throw new UnauthorizedException("Credenciais administrativas inválidas");
    }
    return {
      user: { id: user.id, email: user.email, role: user.role },
      ...(await this.createSession(user.id)),
    };
  }

  async authenticate(request: FastifyRequest, requiredRole?: Role) {
    const token = request.cookies?.atlas_session;
    if (!token) throw new UnauthorizedException("Sessão ausente");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      (requiredRole && session.user.role !== requiredRole)
    ) {
      throw new UnauthorizedException("Sessão inválida");
    }
    return session;
  }

  async logout(request: FastifyRequest) {
    const token = request.cookies?.atlas_session;
    if (!token) return;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(userId: string) {
    const issued = issueSession();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await this.prisma.session.create({
      data: { userId, tokenHash: issued.tokenHash, expiresAt },
    });
    return { token: issued.token, expiresAt };
  }
}
