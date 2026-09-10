import { describe, expect, it } from "vitest";
import { CaixaServiceBusProvider } from "./ingestion.js";

describe("CaixaServiceBusProvider", () => {
  const provider = new CaixaServiceBusProvider();

  it("normalizes Mega-Sena without inventing draw order", () => {
    const result = provider.normalize("mega-sena", {
      numero: 3055,
      dataApuracao: "08/09/2026",
      listaDezenas: ["01", "11", "36", "43", "48", "49"],
      dezenasSorteadasOrdemSorteio: ["36", "43", "48", "11", "49", "01"],
    });
    expect(result.input.contestNumber).toBe(3055);
    expect(result.input.drawDate).toBe("2026-09-08");
    expect(result.input.numbers).toEqual([1, 11, 36, 43, 48, 49]);
    expect(result.input.originalOrder).toEqual([36, 43, 48, 11, 49, 1]);
  });

  it("normalizes Dia de Sorte month independently", () => {
    const result = provider.normalize("dia-de-sorte", {
      numero: 100,
      dataApuracao: "01/09/2026",
      listaDezenas: ["01", "02", "03", "04", "05", "06", "07"],
      nomeTimeCoracaoMesSorte: "Setembro",
    });
    expect(result.input.luckyMonth).toBe(9);
  });

  it("normalizes the numeric month used by official Dia de Sorte payloads", () => {
    const result = provider.normalize("dia-de-sorte", {
      numero: 1,
      dataApuracao: "19/05/2018",
      listaDezenas: ["03", "05", "08", "09", "19", "21", "30"],
      dezenasSorteadasOrdemSorteio: ["03", "09", "05", "30", "08", "19", "21"],
      nomeTimeCoracaoMesSorte: "2",
    });
    expect(result.input.luckyMonth).toBe(2);
  });

  it("normalizes prize tiers and next-contest metadata", () => {
    const result = provider.normalize("dia-de-sorte", {
      numero: 1293,
      tipoJogo: "DIA_DE_SORTE",
      dataApuracao: "09/09/2026",
      dataProximoConcurso: "10/09/2026",
      numeroConcursoProximo: 1294,
      valorEstimadoProximoConcurso: 520000,
      listaDezenas: ["06", "11", "12", "14", "22", "26", "28"],
      nomeTimeCoracaoMesSorte: "Novembro",
      listaRateioPremio: [
        {
          descricaoFaixa: "7 acertos",
          numeroDeGanhadores: 0,
          valorPremio: 0,
        },
        {
          descricaoFaixa: "Mês da Sorte",
          numeroDeGanhadores: 40629,
          valorPremio: 2.5,
        },
      ],
    });
    expect(result.input.luckyMonth).toBe(11);
    expect(result.nextContest).toEqual({
      contestNumber: 1294,
      drawDate: "2026-09-10",
      estimatedPrizeCents: 52_000_000n,
    });
    expect(result.prizes).toEqual([
      {
        label: "7 acertos",
        hits: 7,
        luckyMonthRequired: false,
        winners: 0,
        amountCents: 0n,
      },
      {
        label: "Mês da Sorte",
        hits: 0,
        luckyMonthRequired: true,
        winners: 40629,
        amountCents: 250n,
      },
    ]);
  });

  it("rejects a payload from another lottery", () => {
    expect(() =>
      provider.normalize("mega-sena", {
        numero: 1,
        tipoJogo: "LOTOFACIL",
        dataApuracao: "11/03/1996",
        listaDezenas: ["04", "05", "30", "33", "41", "52"],
      }),
    ).toThrow("Modalidade divergente");
  });
});
