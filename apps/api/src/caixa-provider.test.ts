import { describe, expect, it } from "vitest";
import { CaixaServiceBusProvider } from "./ingestion.js";

describe("CaixaServiceBusProvider", () => {
  const provider = new CaixaServiceBusProvider();

  it("normalizes Mega-Sena without inventing draw order", () => {
    const result = provider.normalize("mega-sena", {
      numero: 3055,
      dataApuracao: "08/09/2026",
      listaDezenas: ["01", "11", "36", "43", "48", "49"],
    });
    expect(result.contestNumber).toBe(3055);
    expect(result.drawDate).toBe("2026-09-08");
    expect(result.numbers).toEqual([1, 11, 36, 43, 48, 49]);
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
});
