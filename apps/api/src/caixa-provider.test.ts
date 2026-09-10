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
    expect(result.contestNumber).toBe(3055);
    expect(result.drawDate).toBe("2026-09-08");
    expect(result.numbers).toEqual([1, 11, 36, 43, 48, 49]);
    expect(result.originalOrder).toEqual([36, 43, 48, 11, 49, 1]);
  });

  it("normalizes Dia de Sorte month independently", () => {
    const result = provider.normalize("dia-de-sorte", {
      numero: 100,
      dataApuracao: "01/09/2026",
      listaDezenas: ["01", "02", "03", "04", "05", "06", "07"],
      nomeTimeCoracaoMesSorte: "Setembro",
    });
    expect(result.luckyMonth).toBe(9);
  });

  it("normalizes the numeric month used by official Dia de Sorte payloads", () => {
    const result = provider.normalize("dia-de-sorte", {
      numero: 1,
      dataApuracao: "19/05/2018",
      listaDezenas: ["03", "05", "08", "09", "19", "21", "30"],
      dezenasSorteadasOrdemSorteio: ["03", "09", "05", "30", "08", "19", "21"],
      nomeTimeCoracaoMesSorte: "2",
    });
    expect(result.luckyMonth).toBe(2);
  });
});
