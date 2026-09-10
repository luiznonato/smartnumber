import { describe, expect, it } from "vitest";
import { parseOfficialCsv } from "./admin-import.service.js";

describe("administrative official-file importer", () => {
  it("maps a validated Mega-Sena CSV", () => {
    const rows = parseOfficialCsv(
      [
        "concurso;data;dezenas",
        '1;1996-03-11;"04 05 30 33 41 52"',
      ].join("\n"),
      "mega-sena",
      "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx",
      {
        contestNumber: "concurso",
        drawDate: "data",
        numbers: "dezenas",
      },
    );
    expect(rows[0].input).toMatchObject({
      contestNumber: 1,
      numbers: [4, 5, 30, 33, 41, 52],
    });
  });

  it("keeps invalid rows for preview instead of accepting them", () => {
    const rows = parseOfficialCsv(
      ["concurso;data;dezenas", "1;1996-03-11;04 05 30"].join("\n"),
      "mega-sena",
      "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx",
      {
        contestNumber: "concurso",
        drawDate: "data",
        numbers: "dezenas",
      },
    );
    expect(rows[0].input).toBeUndefined();
    expect(rows[0].error).toContain("exige 6 dezenas");
  });

  it("requires an explicit existing column mapping", () => {
    expect(() =>
      parseOfficialCsv(
        ["id;data;dezenas", "1;1996-03-11;04 05 30 33 41 52"].join("\n"),
        "mega-sena",
        "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx",
        {
          contestNumber: "concurso",
          drawDate: "data",
          numbers: "dezenas",
        },
      ),
    ).toThrow("Coluna não encontrada: concurso");
  });
});
