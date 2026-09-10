import { createHash } from "node:crypto";
import {
  drawSchema,
  lotterySlugSchema,
  type DrawInput,
  type LotterySlug,
} from "@atlas/contracts";

export type NormalizedPrizeTier = {
  label: string;
  hits: number;
  luckyMonthRequired: boolean;
  winners: number | null;
  amountCents: bigint | null;
};

export type CaixaFetchResult = {
  raw: Record<string, unknown>;
  input: DrawInput;
  url: string;
  fetchedAt: Date;
  payloadHash: string;
  accumulated: boolean | null;
  prizes: NormalizedPrizeTier[] | null;
  nextContest: {
    contestNumber: number | null;
    drawDate: string | null;
    estimatedPrizeCents: bigint | null;
  };
};

export interface LotteryResultsProvider {
  latest(lottery: LotterySlug): Promise<CaixaFetchResult>;
  byContest(
    lottery: LotterySlug,
    contest: number,
  ): Promise<CaixaFetchResult>;
}

export class DisabledCaixaProvider implements LotteryResultsProvider {
  private fail(): never {
    throw new Error(
      "Fonte automática CAIXA desativada: interface pública documentada não foi confirmada",
    );
  }
  async latest(_lottery: LotterySlug) {
    return this.fail();
  }
  async byContest(_lottery: LotterySlug, _contest: number) {
    return this.fail();
  }
}

const caixaPaths: Record<LotterySlug, string> = {
  "mega-sena": "megasena",
  lotofacil: "lotofacil",
  "dia-de-sorte": "diadesorte",
};
const expectedGameTypes: Record<LotterySlug, string> = {
  "mega-sena": "MEGA_SENA",
  lotofacil: "LOTOFACIL",
  "dia-de-sorte": "DIA_DE_SORTE",
};
const months = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function parseCaixaDate(value: unknown): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? ""));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function moneyToCents(value: unknown): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Valor monetário CAIXA inválido");
  }
  return BigInt(Math.round(amount * 100));
}

function normalizePrizes(raw: unknown): NormalizedPrizeTier[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) throw new Error("Rateio CAIXA inválido");
  return raw.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("Faixa de prêmio CAIXA inválida");
    }
    const tier = item as Record<string, unknown>;
    const label = String(tier.descricaoFaixa ?? "").trim();
    const isMonth = label.toLocaleLowerCase("pt-BR").includes("mês");
    const hitMatch = /^(\d+)\s+acertos?$/i.exec(label);
    const winners =
      tier.numeroDeGanhadores === null ||
      tier.numeroDeGanhadores === undefined
        ? null
        : Number(tier.numeroDeGanhadores);
    if (
      !label ||
      (!isMonth && !hitMatch) ||
      (winners !== null && (!Number.isInteger(winners) || winners < 0))
    ) {
      throw new Error("Faixa de prêmio CAIXA inválida");
    }
    return {
      label,
      hits: hitMatch ? Number(hitMatch[1]) : 0,
      luckyMonthRequired: isMonth,
      winners,
      amountCents: moneyToCents(tier.valorPremio),
    };
  });
}

export class CaixaServiceBusProvider implements LotteryResultsProvider {
  readonly base =
    "https://servicebus2.caixa.gov.br/portaldeloterias/api";

  endpointUrl(lottery: LotterySlug, contest?: number) {
    return `${this.base}/${caixaPaths[lottery]}${contest ? `/${contest}` : ""}`;
  }

  async latest(lottery: LotterySlug) {
    return this.fetch(lottery);
  }

  async byContest(lottery: LotterySlug, contest: number) {
    if (!Number.isInteger(contest) || contest < 1) {
      throw new Error("Concurso inválido");
    }
    const result = await this.fetch(lottery, contest);
    if (result.input.contestNumber !== contest) {
      throw new Error(
        `Identidade divergente: solicitado ${contest}, recebido ${result.input.contestNumber}`,
      );
    }
    return result;
  }

  normalize(
    lotteryInput: string,
    raw: unknown,
    fetchedAt = new Date(),
    sourceUrl?: string,
  ): CaixaFetchResult {
    const lottery = lotterySlugSchema.parse(lotteryInput);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error("Payload CAIXA inválido");
    }
    const value = raw as Record<string, unknown>;
    if (
      value.tipoJogo &&
      String(value.tipoJogo) !== expectedGameTypes[lottery]
    ) {
      throw new Error("Modalidade divergente no payload CAIXA");
    }
    const drawDate = parseCaixaDate(value.dataApuracao);
    if (!drawDate) throw new Error("Data CAIXA inválida");
    const luckyName = String(value.nomeTimeCoracaoMesSorte ?? "")
      .trim()
      .toLocaleLowerCase("pt-BR");
    const numericLuckyMonth = Number(luckyName);
    const luckyMonth =
      Number.isInteger(numericLuckyMonth) &&
      numericLuckyMonth >= 1 &&
      numericLuckyMonth <= 12
        ? numericLuckyMonth
        : months.indexOf(luckyName) + 1;
    const contestNumber = Number(value.numero);
    const url = sourceUrl ?? this.endpointUrl(lottery, contestNumber);
    const input = drawSchema.parse({
      lottery,
      contestNumber,
      drawDate,
      numbers: Array.isArray(value.listaDezenas)
        ? value.listaDezenas.map(Number)
        : [],
      originalOrder: Array.isArray(value.dezenasSorteadasOrdemSorteio)
        ? value.dezenasSorteadasOrdemSorteio.map(Number)
        : undefined,
      luckyMonth: lottery === "dia-de-sorte" ? luckyMonth : undefined,
      sourceUrl: url,
      fetchedAt: fetchedAt.toISOString(),
      parserVersion: "caixa-portal-servicebus-v2",
    });
    return {
      raw: value,
      input,
      url,
      fetchedAt,
      payloadHash: payloadHash(value),
      accumulated:
        typeof value.acumulado === "boolean" ? value.acumulado : null,
      prizes: normalizePrizes(value.listaRateioPremio),
      nextContest: {
        contestNumber:
          Number.isInteger(Number(value.numeroConcursoProximo)) &&
          Number(value.numeroConcursoProximo) > contestNumber
            ? Number(value.numeroConcursoProximo)
            : null,
        drawDate: parseCaixaDate(value.dataProximoConcurso),
        estimatedPrizeCents: moneyToCents(
          value.valorEstimadoProximoConcurso,
        ),
      },
    };
  }

  private async fetch(
    lottery: LotterySlug,
    contest?: number,
  ): Promise<CaixaFetchResult> {
    const url = this.endpointUrl(lottery, contest);
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "user-agent":
              process.env.CAIXA_USER_AGENT ??
              "AtlasLoto/0.1 (resultados; configure CAIXA_USER_AGENT)",
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          const retryable =
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500;
          const error = Object.assign(
            new Error(`CAIXA HTTP ${response.status}`),
            { retryable, statusCode: response.status },
          );
          throw error;
        }
        const contentLength = Number(response.headers.get("content-length"));
        if (contentLength > 2_000_000) {
          throw Object.assign(new Error("Payload CAIXA excede 2 MB"), {
            retryable: false,
          });
        }
        const text = await response.text();
        if (text.length > 2_000_000) {
          throw Object.assign(new Error("Payload CAIXA excede 2 MB"), {
            retryable: false,
          });
        }
        return this.normalize(lottery, JSON.parse(text), new Date(), url);
      } catch (error) {
        lastError = error;
        if (
          (error as { retryable?: boolean }).retryable === false ||
          attempt === 2
        ) {
          break;
        }
        const delay =
          250 * 2 ** attempt + Math.floor(Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }
}

export function normalizeOfficialJson(
  raw: unknown,
  sourceUrl: string,
): DrawInput {
  if (!sourceUrl.startsWith("https://loterias.caixa.gov.br/")) {
    throw new Error("Origem não permitida");
  }
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Payload deve ser objeto");
  }
  const value = raw as Record<string, unknown>;
  return drawSchema.parse({
    lottery: value.lottery,
    contestNumber: Number(value.contestNumber),
    drawDate: value.drawDate,
    numbers: Array.isArray(value.numbers)
      ? value.numbers.map(Number)
      : value.numbers,
    luckyMonth:
      value.luckyMonth == null ? null : Number(value.luckyMonth),
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    parserVersion: "official-json-v1",
  });
}

export function payloadHash(raw: unknown) {
  return createHash("sha256").update(JSON.stringify(raw)).digest("hex");
}

export function parseAdminJson(text: string, sourceUrl: string) {
  const value = JSON.parse(text);
  const rows = Array.isArray(value) ? value : [value];
  return rows.map((row, index) => {
    try {
      return {
        row: index + 1,
        status: "accepted" as const,
        value: normalizeOfficialJson(row, sourceUrl),
      };
    } catch (error) {
      return {
        row: index + 1,
        status: "rejected" as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
