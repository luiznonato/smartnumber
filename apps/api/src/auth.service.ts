import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import * as OTPAuth from "otpauth";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  hashPassword,
  issueSession,
  recoveryCodeHash,
  verifyPassword,
} from "./auth.js";
import { PrismaService } from "./database.js";

const SESSION_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    if (!email.includes("@")) throw new UnauthorizedException("E-mail inválido");
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException("E-mail já cadastrado");
    }
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { id, email, passwordHash },
        select: { id: true, email: true, role: true },
      });
      await tx.$executeRaw`SELECT set_config('app.user_id', ${id}, true)`;
      await tx.userPreferences.create({ data: { userId: id } });
      return created;
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
    if (user.suspendedAt) {
      throw new UnauthorizedException("Acesso suspenso");
    }
    if (requiredRole === Role.ADMIN) {
      throw new UnauthorizedException("Use o fluxo administrativo com MFA");
    }
    return {
      user: { id: user.id, email: user.email, role: user.role },
      ...(await this.createSession(user.id)),
    };
  }

  async beginAdminLogin(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.role !== Role.ADMIN ||
      user.suspendedAt ||
      !(await verifyPassword(user.passwordHash, password))
    ) {
      throw new UnauthorizedException("Credenciais administrativas inválidas");
    }
    let encryptedSecret = user.adminMfaSecretEncrypted;
    let setupSecret: string | undefined;
    if (!encryptedSecret) {
      setupSecret = new OTPAuth.Secret({ size: 20 }).base32;
      encryptedSecret = encryptMfaSecret(
        setupSecret,
        this.mfaEncryptionSecret(),
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { adminMfaSecretEncrypted: encryptedSecret },
      });
    }
    const challenge = await this.issueAdminChallenge(user.id);
    return {
      challenge,
      setupRequired: !user.adminMfaEnabledAt,
      ...(setupSecret
        ? {
            setup: {
              secret: setupSecret,
              uri: this.totp(setupSecret, user.email).toString(),
            },
          }
        : {}),
    };
  }

  async completeAdminMfa(
    challenge: string,
    code: string,
    setup: boolean,
  ) {
    const userId = await this.verifyAdminChallenge(challenge);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (
      user.role !== Role.ADMIN ||
      user.suspendedAt ||
      !user.adminMfaSecretEncrypted
    ) {
      throw new UnauthorizedException("Desafio administrativo inválido");
    }
    const secret = decryptMfaSecret(
      user.adminMfaSecretEncrypted,
      this.mfaEncryptionSecret(),
    );
    const validTotp =
      this.totp(secret, user.email).validate({
        token: code.replace(/\s/g, ""),
        window: 1,
      }) !== null;
    if (!validTotp) {
      if (setup || !user.adminMfaEnabledAt) {
        throw new UnauthorizedException("Código MFA inválido");
      }
      const candidateHash = recoveryCodeHash(
        code,
        this.mfaEncryptionSecret(),
      );
      if (!user.adminMfaRecoveryHashes.includes(candidateHash)) {
        throw new UnauthorizedException("Código MFA inválido");
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          adminMfaRecoveryHashes: user.adminMfaRecoveryHashes.filter(
            (hash) => hash !== candidateHash,
          ),
        },
      });
    }
    let recoveryCodes: string[] | undefined;
    if (!user.adminMfaEnabledAt) {
      if (!setup) {
        throw new UnauthorizedException("Configuração MFA obrigatória");
      }
      recoveryCodes = Array.from({ length: 8 }, () => {
        const raw = randomBytes(6).toString("hex").toUpperCase();
        return `${raw.slice(0, 6)}-${raw.slice(6)}`;
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          adminMfaEnabledAt: new Date(),
          adminMfaRecoveryHashes: recoveryCodes.map((recoveryCode) =>
            recoveryCodeHash(
              recoveryCode,
              this.mfaEncryptionSecret(),
            ),
          ),
        },
      });
    }
    return {
      user: { id: user.id, email: user.email, role: user.role },
      ...(await this.createSession(user.id, true)),
      recoveryCodes,
    };
  }

  async authenticate(request: FastifyRequest, requiredRole?: Role) {
    const token = request.cookies?.atlas_session;
    if (!token) throw new UnauthorizedException("Sessão ausente");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            suspendedAt: true,
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.suspendedAt ||
      (requiredRole && session.user.role !== requiredRole) ||
      (requiredRole === Role.ADMIN && !session.adminMfaVerifiedAt)
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

  private async createSession(userId: string, adminMfaVerified = false) {
    const issued = issueSession();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: issued.tokenHash,
        expiresAt,
        adminMfaVerifiedAt: adminMfaVerified ? new Date() : null,
      },
    });
    return { token: issued.token, expiresAt };
  }

  private mfaEncryptionSecret() {
    return process.env.ADMIN_MFA_ENCRYPTION_KEY ?? "";
  }

  private async issueAdminChallenge(userId: string) {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres");
    }
    return new SignJWT({ purpose: "admin-mfa" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(secret));
  }

  private async verifyAdminChallenge(challenge: string) {
    try {
      const secret = process.env.SESSION_SECRET;
      if (!secret || secret.length < 32) throw new Error("secret missing");
      const { payload } = await jwtVerify(
        challenge,
        new TextEncoder().encode(secret),
      );
      if (payload.purpose !== "admin-mfa" || !payload.sub) {
        throw new Error("invalid challenge");
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException(
        "Desafio administrativo inválido ou expirado",
      );
    }
  }

  private totp(secret: string, email: string) {
    return new OTPAuth.TOTP({
      issuer: process.env.APP_NAME ?? "Atlas Loto",
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
  }
}
