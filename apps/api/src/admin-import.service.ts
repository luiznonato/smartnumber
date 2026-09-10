import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import {
  drawSchema,
  lotterySlugSchema,
  type DrawInput,
  type LotterySlug,
} from "@atlas/contracts";
import { createHash } from "node:crypto";
import { PrismaService } from "./database.js";
import {
  CaixaServiceBusProvider,
  normalizeOfficialJson,
} from "./ingestion.js";
import { LotteryFlowService } from "./lottery-flow.service.js";

type ColumnMapping = {
  contestNumber: string;
  drawDate: string;
  numbers: string;
  luckyMonth?: string;
  originalOrder?: string;
};

type PreviewRow = {
  row: number;
  status: "accepted" | "duplicate" | "conflict" | "invalid";
  input?: DrawInput;
  raw?: unknown;
  error?: string;
};

function parseCsvLine(line: string, delimiter: string) {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      fields.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("CSV contém aspas não fechadas");
  fields.push(value.trim());
  return fields;
}

export function parseOfficialCsv(
  content: string,
  lottery: LotterySlug,
  sourceUrl: string,
  mapping: ColumnMapping,
  delimiter = ";",
) {
  if (![",", ";"].includes(delimiter)) {
    throw new Error("Delimitador deve ser vírgula ou ponto e vírgula");
  }
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV sem linhas de dados");
  const headers = parseCsvLine(lines[0], delimiter);
  for (const required of [
    mapping.contestNumber,
    mapping.drawDate,
    mapping.numbers,
  ]) {
    if (!headers.includes(required)) {
      throw new Error(`Coluna não encontrada: ${required}`);
    }
  }
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const record = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    );
    try {
      const numbers = record[mapping.numbers]
        .split(/[\s|/-]+/)
        .filter(Boolean)
        .map(Number);
      const originalOrder = mapping.originalOrder
        ? record[mapping.originalOrder]
            .split(/[\s|/-]+/)
            .filter(Boolean)
            .map(Number)
        : undefined;
      return {
        raw: record,
        input: drawSchema.parse({
          lottery,
          contestNumber: Number(record[mapping.contestNumber]),
          drawDate: record[mapping.drawDate],
          numbers,
          originalOrder,
          luckyMonth: lottery === "dia-de-sorte" && mapping.luckyMonth
            ? Number(record[mapping.luckyMonth])
            : undefined,
          sourceUrl,
          fetchedAt: new Date().toISOString(),
          parserVersion: "admin-official-csv-v1",
        }),
      };
    } catch (error) {
      return {
        raw: record,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

@Injectable()
export class AdminImportService {
  private readonly caixa = new CaixaServiceBusProvider();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LotteryFlowService) private readonly flow: LotteryFlowService,
  ) {}

  async preview(
    actorUserId: string,
    request: {
      lottery: string;
      fileName: string;
      content: string;
      format: "json" | "csv";
      sourceUrl: string;
      delimiter?: string;
      mapping?: ColumnMapping;
    },
  ) {
    const lottery = lotterySlugSchema.parse(request.lottery);
    const bytes = Buffer.byteLength(request.content ?? "", "utf8");
    if (bytes < 1 || bytes > 2_000_000) {
      throw new BadRequestException("Arquivo deve ter entre 1 byte e 2 MB");
    }
    if (!/^https:\/\/([a-z0-9-]+\.)*caixa\.gov\.br\//i.test(request.sourceUrl)) {
      throw new BadRequestException("A origem deve pertencer a caixa.gov.br");
    }
    if (
      (request.format === "json" && !request.fileName.endsWith(".json")) ||
      (request.format === "csv" && !request.fileName.endsWith(".csv"))
    ) {
      throw new BadRequestException("Extensão incompatível com o formato");
    }
    const parsed =
      request.format === "csv"
        ? parseOfficialCsv(
            request.content,
            lottery,
            request.sourceUrl,
            request.mapping ?? {
              contestNumber: "concurso",
              drawDate: "data",
              numbers: "dezenas",
              luckyMonth: "mes",
            },
            request.delimiter,
          )
        : this.parseJson(request.content, lottery, request.sourceUrl);
    if (parsed.length > 10_000) {
      throw new BadRequestException("Arquivo excede 10.000 concursos");
    }
    const rows: PreviewRow[] = [];
    for (const [index, parsedRow] of parsed.entries()) {
      if (!parsedRow.input) {
        rows.push({
          row: index + 2,
          status: "invalid",
          error: parsedRow.error ?? "Linha inválida",
        });
        continue;
      }
      try {
        const existing = await this.prisma.draw.findFirst({
          where: {
            lottery: { slug: lottery },
            contestNumber: parsedRow.input.contestNumber,
          },
          include: { revisions: true },
        });
        const canonical = existing?.revisions.find(
          (revision) => revision.id === existing.canonicalRevisionId,
        );
        const same =
          canonical &&
          [...canonical.numbers].sort((a, b) => a - b).join(",") ===
            [...parsedRow.input.numbers].sort((a, b) => a - b).join(",") &&
          canonical.luckyMonth === (parsedRow.input.luckyMonth ?? null);
        rows.push({
          row: index + 2,
          status: same ? "duplicate" : existing ? "conflict" : "accepted",
          input: parsedRow.input,
          raw: parsedRow.raw,
        });
      } catch (error) {
        rows.push({
          row: index + 2,
          status: "invalid",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const hash = createHash("sha256").update(request.content).digest("hex");
    const run = await this.prisma.importRun.create({
      data: {
        lotterySlug: lottery,
        format: `admin-official-${request.format}-v1`,
        checkpoint: { nextIndex: 0 },
        status: JobStatus.PENDING,
        recordsRead: rows.length,
        recordsAccepted: rows.filter((row) => row.status === "accepted").length,
        sourceFileName: request.fileName,
        sourceFileHash: hash,
        actorUserId,
        preview: {
          lottery,
          sourceUrl: request.sourceUrl,
          format: request.format,
          rows,
        } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "import.preview",
        resourceType: "ImportRun",
        resourceId: run.id,
        metadata: { fileName: request.fileName, hash, rows: rows.length },
      },
    });
    return {
      importRunId: run.id,
      fileName: request.fileName,
      fileHash: hash,
      summary: {
        accepted: rows.filter((row) => row.status === "accepted").length,
        duplicate: rows.filter((row) => row.status === "duplicate").length,
        conflict: rows.filter((row) => row.status === "conflict").length,
        invalid: rows.filter((row) => row.status === "invalid").length,
      },
      rows: rows.map(({ raw: _raw, ...row }) => row),
    };
  }

  async confirm(actorUserId: string, importRunId: string) {
    const run = await this.prisma.importRun.findUnique({
      where: { id: importRunId },
    });
    if (!run) throw new NotFoundException("Prévia não encontrada");
    if (run.status === JobStatus.COMPLETED) {
      return { importRunId, duplicate: true, imported: run.recordsAccepted };
    }
    if (run.actorUserId !== actorUserId) {
      throw new BadRequestException(
        "A confirmação deve ser feita pelo administrador que criou a prévia",
      );
    }
    const preview = run.preview as {
      rows?: PreviewRow[];
    } | null;
    const accepted = (preview?.rows ?? []).filter(
      (row) => row.status === "accepted" && row.input,
    );
    await this.prisma.importRun.update({
      where: { id: run.id },
      data: { status: JobStatus.RUNNING },
    });
    try {
      for (const [index, row] of accepted.entries()) {
        const normalized =
          typeof row.raw === "object" &&
          row.raw !== null &&
          "numero" in row.raw
            ? this.caixa.normalize(run.lotterySlug, row.raw)
            : null;
        await this.flow.importConfirmed(
          normalized?.input ?? row.input!,
          row.raw,
          {
            publishAnalysis: index === accepted.length - 1,
            prizes: normalized?.prizes,
            nextPublication: normalized?.nextContest,
          },
        );
        await this.prisma.importRun.update({
          where: { id: run.id },
          data: { checkpoint: { nextIndex: index + 1 } },
        });
      }
      await this.prisma.$transaction([
        this.prisma.importRun.update({
          where: { id: run.id },
          data: { status: JobStatus.COMPLETED, finishedAt: new Date() },
        }),
        this.prisma.auditLog.create({
          data: {
            actorUserId,
            action: "import.confirm",
            resourceType: "ImportRun",
            resourceId: run.id,
            metadata: {
              imported: accepted.length,
              fileHash: run.sourceFileHash,
            },
          },
        }),
      ]);
      return { importRunId, duplicate: false, imported: accepted.length };
    } catch (error) {
      await this.prisma.importRun.update({
        where: { id: run.id },
        data: { status: JobStatus.FAILED, finishedAt: new Date() },
      });
      throw error;
    }
  }

  private parseJson(
    content: string,
    lottery: LotterySlug,
    sourceUrl: string,
  ) {
    const value = JSON.parse(content) as unknown;
    const rows = Array.isArray(value) ? value : [value];
    return rows.map((raw) => {
      try {
        if (
          typeof raw === "object" &&
          raw !== null &&
          "numero" in raw
        ) {
          const normalized = this.caixa.normalize(lottery, raw);
          return { raw, input: normalized.input };
        }
        return { raw, input: normalizeOfficialJson(raw, sourceUrl) };
      } catch (error) {
        return {
          raw,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  }
}
