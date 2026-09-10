import type { LotterySlug } from "@atlas/contracts";

type OfficialFixture = {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
  dezenasSorteadasOrdemSorteio: string[];
  nomeTimeCoracaoMesSorte?: string;
};

// Payload fields captured from the CAIXA portal service on 2026-09-10.
// Source pattern:
// https://servicebus2.caixa.gov.br/portaldeloterias/api/{modalidade}/{concurso}
export const OFFICIAL_LIFECYCLE_FIXTURES: Record<
  LotterySlug,
  OfficialFixture[]
> = {
  "mega-sena": [
    {
      numero: 1,
      dataApuracao: "11/03/1996",
      listaDezenas: ["04", "05", "30", "33", "41", "52"],
      dezenasSorteadasOrdemSorteio: ["41", "05", "04", "52", "30", "33"],
    },
    {
      numero: 2,
      dataApuracao: "18/03/1996",
      listaDezenas: ["09", "37", "39", "41", "43", "49"],
      dezenasSorteadasOrdemSorteio: ["09", "39", "37", "49", "43", "41"],
    },
    {
      numero: 3,
      dataApuracao: "25/03/1996",
      listaDezenas: ["10", "11", "29", "30", "36", "47"],
      dezenasSorteadasOrdemSorteio: ["36", "30", "10", "11", "29", "47"],
    },
  ],
  lotofacil: [
    {
      numero: 1,
      dataApuracao: "29/09/2003",
      listaDezenas: [
        "02", "03", "05", "06", "09", "10", "11", "13",
        "14", "16", "18", "20", "23", "24", "25",
      ],
      dezenasSorteadasOrdemSorteio: [
        "18", "20", "25", "23", "10", "11", "24", "14",
        "06", "02", "13", "09", "05", "16", "03",
      ],
    },
    {
      numero: 2,
      dataApuracao: "06/10/2003",
      listaDezenas: [
        "01", "04", "05", "06", "07", "09", "11", "12",
        "13", "15", "16", "19", "20", "23", "24",
      ],
      dezenasSorteadasOrdemSorteio: [
        "23", "15", "05", "04", "12", "16", "20", "06",
        "11", "19", "24", "01", "09", "13", "07",
      ],
    },
    {
      numero: 3,
      dataApuracao: "13/10/2003",
      listaDezenas: [
        "01", "04", "06", "07", "08", "09", "10", "11",
        "12", "14", "16", "17", "20", "23", "24",
      ],
      dezenasSorteadasOrdemSorteio: [
        "20", "23", "12", "08", "06", "01", "07", "11",
        "14", "04", "16", "10", "09", "17", "24",
      ],
    },
  ],
  "dia-de-sorte": [
    {
      numero: 1,
      dataApuracao: "19/05/2018",
      listaDezenas: ["03", "05", "08", "09", "19", "21", "30"],
      dezenasSorteadasOrdemSorteio: ["03", "09", "05", "30", "08", "19", "21"],
      nomeTimeCoracaoMesSorte: "2",
    },
    {
      numero: 2,
      dataApuracao: "22/05/2018",
      listaDezenas: ["08", "11", "12", "14", "20", "21", "28"],
      dezenasSorteadasOrdemSorteio: ["12", "28", "21", "08", "11", "14", "20"],
      nomeTimeCoracaoMesSorte: "12",
    },
    {
      numero: 3,
      dataApuracao: "24/05/2018",
      listaDezenas: ["11", "12", "21", "24", "25", "28", "29"],
      dezenasSorteadasOrdemSorteio: ["11", "25", "28", "12", "21", "29", "24"],
      nomeTimeCoracaoMesSorte: "4",
    },
  ],
};
