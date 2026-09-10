import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./database.js";

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async overview() {
    const [
      users,
      activeSessions,
      imports,
      qualityIssues,
      pendingOutbox,
      failedJobs,
      strategies,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.session.count({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.prisma.importRun.count(),
      this.prisma.dataQualityIssue.count({ where: { resolvedAt: null } }),
      this.prisma.outboxEvent.count({ where: { publishedAt: null } }),
      this.prisma.jobRun.count({ where: { status: "FAILED" } }),
      this.prisma.strategyVersion.count(),
    ]);
    return {
      users,
      activeSessions,
      imports,
      qualityIssues,
      pendingOutbox,
      failedJobs,
      strategyVersions: strategies,
    };
  }

  users() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        suspendedAt: true,
        createdAt: true,
      },
    });
  }

  async suspendUser(
    actorUserId: string,
    targetUserId: string,
    suspended: boolean,
  ) {
    if (actorUserId === targetUserId) {
      throw new BadRequestException("Não é possível suspender a própria conta");
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException("Usuário não encontrado");
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: { suspendedAt: suspended ? new Date() : null },
        select: {
          id: true,
          email: true,
          role: true,
          suspendedAt: true,
        },
      });
      if (suspended) {
        await tx.session.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: suspended ? "user.suspend" : "user.restore",
          resourceType: "User",
          resourceId: targetUserId,
          metadata: {},
        },
      });
      return user;
    });
  }

  plans() {
    return this.prisma.plan.findMany({ orderBy: { code: "asc" } });
  }

  async upsertPlan(
    actorUserId: string,
    input: { code: string; name: string; limits: Record<string, unknown> },
  ) {
    if (!/^[a-z0-9-]{2,40}$/.test(input.code) || !input.name.trim()) {
      throw new BadRequestException("Plano inválido");
    }
    const plan = await this.prisma.plan.upsert({
      where: { code: input.code },
      update: {
        name: input.name.trim(),
        limits: input.limits as Prisma.InputJsonValue,
      },
      create: {
        code: input.code,
        name: input.name.trim(),
        limits: input.limits as Prisma.InputJsonValue,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "plan.upsert",
        resourceType: "Plan",
        resourceId: plan.id,
        metadata: { code: plan.code },
      },
    });
    return plan;
  }
}
