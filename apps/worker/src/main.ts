import { Prisma, PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

type DrawEventPayload = {
  revisionId: string;
  publishAnalysis?: boolean;
};

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const prisma = new PrismaClient();
const events = new Queue<DrawEventPayload>("atlas-draw-events", {
  connection: redis,
});
const dead = new Queue("atlas-dead-letter", { connection: redis });
const internalSecret = process.env.WORKER_INTERNAL_SECRET;
const apiUrl = process.env.INTERNAL_API_URL ?? "http://api:3001";

if (!internalSecret || internalSecret.length < 32) {
  throw new Error("WORKER_INTERNAL_SECRET deve ter pelo menos 32 caracteres");
}

async function dispatchOutbox() {
  const pending = await prisma.outboxEvent.findMany({
    where: {
      publishedAt: null,
      type: { in: ["draw.confirmed", "draw.corrected"] },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  for (const event of pending) {
    const payload = event.payload as Prisma.JsonObject;
    if (typeof payload.revisionId !== "string") continue;
    await events.add(
      event.type,
      {
        revisionId: payload.revisionId,
        publishAnalysis: payload.publishAnalysis !== false,
      },
      {
        jobId: event.id,
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: false,
      },
    );
  }
}

const worker = new Worker<DrawEventPayload>(
  "atlas-draw-events",
  async (job) => {
    const response = await fetch(`${apiUrl}/api/internal/draw-events/process`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-atlas-worker-secret": internalSecret,
      },
      body: JSON.stringify(job.data),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      throw new Error(
        `Processamento interno respondeu ${response.status}: ${await response.text()}`,
      );
    }
    await prisma.outboxEvent.update({
      where: { id: String(job.id) },
      data: { publishedAt: new Date(), attempts: { increment: 1 } },
    });
    return response.json();
  },
  {
    connection: redis,
    // A fila única preserva a ordem dos concursos. Particionamento futuro deve
    // manter concorrência 1 por modalidade.
    concurrency: 1,
    lockDuration: 180_000,
  },
);

worker.on("failed", async (job, error) => {
  if (!job) return;
  await prisma.outboxEvent
    .update({
      where: { id: String(job.id) },
      data: { attempts: { increment: 1 } },
    })
    .catch(() => undefined);
  if (job.attemptsMade >= 3) {
    await dead.add(
      "draw-event-failed",
      { jobId: job.id, error: error.message, payload: job.data },
      { jobId: `failed-${job.id}` },
    );
  }
});

const timer = setInterval(
  () =>
    dispatchOutbox().catch((error: unknown) =>
      console.error(
        JSON.stringify({
          service: "worker",
          event: "outbox_dispatch_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
    ),
  Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 2_000),
);
await dispatchOutbox();

async function shutdown() {
  clearInterval(timer);
  await worker.close();
  await events.close();
  await dead.close();
  await prisma.$disconnect();
  await redis.quit();
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
console.log(
  JSON.stringify({
    service: "worker",
    status: "ready",
    queue: "atlas-draw-events",
    concurrency: 1,
  }),
);