import { JobStatus } from "@prisma/client";
import { lotterySlugSchema } from "@atlas/contracts";
import { readFile } from "node:fs/promises";
import { PrismaService } from "./database.js";
import { CaixaServiceBusProvider } from "./ingestion.js";
import { LotteryFlowService } from "./lottery-flow.service.js";
import { GameService } from "./services.js";

const [command, ...args] = process.argv.slice(2);
const options = Object.fromEntries(
  args.map((argument) => {
    const separator = argument.indexOf("=");
    return separator < 0
      ? [argument.replace(/^--/, ""), "true"]
      : [
          argument.slice(0, separator).replace(/^--/, ""),
          argument.slice(separator + 1),
        ];
  }),
);

function lottery() {
  return lotterySlugSchema.parse(options.lottery ?? "mega-sena");
}

function integer(name: string, fallback?: number) {
  const raw = options[name] ?? fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} deve ser inteiro`);
  return value;
}

async function databaseCommand() {
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  const flow = new LotteryFlowService(prisma);
  try {
    switch (command) {
      case "import-history": {
        if (!options.file) throw new Error("Informe file=/caminho/oficial.json");
        const raw = JSON.parse(await readFile(options.file, "utf8")) as unknown;
        const rows = Array.isArray(raw) ? raw : [raw];
        const provider = new CaixaServiceBusProvider();
        const ordered = rows
          .map((payload) => ({
            payload,
            input: provider.normalize(lottery(), payload).input,
          }))
          .sort((a, b) => a.input.contestNumber - b.input.contestNumber);
        const resumed = options.resume
          ? await prisma.importRun.findUnique({
              where: { id: options.resume },
            })
          : null;
        if (options.resume && !resumed) {
          throw new Error("ImportRun informado para retomada não existe");
        }
        if (resumed?.lotterySlug !== undefined && resumed.lotterySlug !== lottery()) {
          throw new Error("ImportRun pertence a outra modalidade");
        }
        const checkpoint =
          resumed?.checkpoint &&
          typeof resumed.checkpoint === "object" &&
          !Array.isArray(resumed.checkpoint)
            ? (resumed.checkpoint as Record<string, unknown>)
            : {};
        if (checkpoint.file && checkpoint.file !== options.file) {
          throw new Error("A retomada exige o mesmo arquivo da execução original");
        }
        const startIndex = resumed ? Number(checkpoint.nextIndex ?? 0) : 0;
        if (!Number.isInteger(startIndex) || startIndex < 0) {
          throw new Error("Checkpoint de importação inválido");
        }
        const run = resumed
          ? await prisma.importRun.update({
              where: { id: resumed.id },
              data: { status: JobStatus.RUNNING, finishedAt: null },
            })
          : await prisma.importRun.create({
              data: {
                lotterySlug: lottery(),
                format: "caixa-servicebus-json",
                checkpoint: { nextIndex: 0, file: options.file },
                status: JobStatus.RUNNING,
              },
            });
        try {
          for (const [index, row] of ordered.entries()) {
            if (index < startIndex) continue;
            const imported = await flow.importConfirmed(row.input, row.payload, {
              publishAnalysis: index === ordered.length - 1,
            });
            await flow.processRevision(
              imported.revisionId,
              index === ordered.length - 1,
            );
            await prisma.importRun.update({
              where: { id: run.id },
              data: {
                checkpoint: {
                  nextIndex: index + 1,
                  contestNumber: row.input.contestNumber,
                  file: options.file,
                },
                recordsRead: index + 1,
                recordsAccepted: index + 1,
              },
            });
          }
          await prisma.importRun.update({
            where: { id: run.id },
            data: { status: JobStatus.COMPLETED, finishedAt: new Date() },
          });
          return { importRunId: run.id, imported: ordered.length };
        } catch (error) {
          await prisma.importRun.update({
            where: { id: run.id },
            data: { status: JobStatus.FAILED, finishedAt: new Date() },
          });
          throw error;
        }
      }
      case "sync-result":
        return await flow.syncLatest(lottery());
      case "sync-history":
        return await flow.syncHistoryBatch(lottery(), {
          startContest: options.start
            ? integer("start")
            : undefined,
          endContest: options.end ? integer("end") : undefined,
          limit: integer("limit", 25),
          resumeId: options.resume,
        });
      case "snapshot":
        return await flow.recalculate(lottery());
      case "evaluate-games":
        return await flow.evaluateContest(lottery(), integer("contest"));
      case "backtest":
        return await flow.backtest(lottery(), {
          ticketsPerContest: integer("tickets", 5),
          minTraining: integer("minTraining", 25),
          seeds: (options.seeds ?? "1,2,3,4,5")
            .split(",")
            .map((seed) => Number(seed)),
          strategy:
            options.strategy === "uniform"
              ? "uniform"
              : "recent-frequency",
        });
      default:
        throw new Error(`Comando desconhecido: ${command ?? ""}`);
    }
  } finally {
    await prisma.onModuleDestroy();
  }
}

async function main() {
  if (command === "generate") {
    return new GameService().generate({
      lottery: lottery(),
      count: integer("count", 1),
      seed: options.seed,
    });
  }
  if (!command) {
    return {
      commands: [
        "generate",
        "import-history",
        "sync-result",
        "sync-history",
        "snapshot",
        "backtest",
        "evaluate-games",
      ],
    };
  }
  return databaseCommand();
}

main()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });