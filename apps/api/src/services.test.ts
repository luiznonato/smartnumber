import { describe, expect, it } from "vitest";
import { generateLuckyMonth } from "./lottery-flow.service.js";
import { GameService, LotteryService } from "./services.js";

describe("domain", () => {
  it("identifies uniform generation only as a random baseline", () => {
    const service = new GameService();
    const first = service.generate({
      lottery: "mega-sena",
      count: 5,
      seed: "x",
    });
    const second = service.generate({
      lottery: "mega-sena",
      count: 5,
      seed: "x",
    });
    expect(first.games).toEqual(second.games);
    expect(first.strategy).toBe("random-baseline-v1");
    expect(first.games[0].score).toBeNull();
    expect(new Set(first.games[0].numbers).size).toBe(6);
  });

  it.each([
    ["mega-sena", 6],
    ["lotofacil", 15],
    ["dia-de-sorte", 7],
  ] as const)("generates valid simple games for %s", (lottery, size) => {
    const game = new GameService().generate({
      lottery,
      count: 1,
      seed: "rules",
    }).games[0];
    expect(game.numbers).toHaveLength(size);
    expect(new Set(game.numbers).size).toBe(size);
  });

  it("checks lucky month independently", () => {
    const result = new GameService().evaluate(
      {
        lottery: "dia-de-sorte",
        numbers: [1, 2, 3, 4, 5, 6, 7],
        luckyMonth: 3,
      },
      [1, 2, 8, 9, 10, 11, 12],
      3,
    );
    expect(result).toEqual({ numberHits: 2, luckyMonthHit: true });
  });

  it("derives a reproducible independent Dia de Sorte month", () => {
    const first = generateLuckyMonth("month-seed", 0);
    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(12);
    expect(generateLuckyMonth("month-seed", 0)).toBe(first);
    expect(
      Array.from({ length: 4 }, (_, index) =>
        generateLuckyMonth("another-seed", index),
      ),
    ).not.toEqual(
      Array.from({ length: 4 }, (_, index) =>
        generateLuckyMonth("month-seed", index),
      ),
    );
  });

  it("evaluates expanded tickets for all modalities", () => {
    const service = new GameService();
    expect(
      service.evaluate(
        { lottery: "mega-sena", numbers: [1, 2, 3, 4, 5, 6, 7] },
        [2, 4, 6, 8, 10, 12],
      ).numberHits,
    ).toBe(3);
    expect(
      service.evaluate(
        {
          lottery: "lotofacil",
          numbers: Array.from({ length: 16 }, (_, index) => index + 1),
        },
        Array.from({ length: 15 }, (_, index) => index + 2),
      ).numberHits,
    ).toBe(15);
  });

  it("validates draws", () =>
    expect(() =>
      new LotteryService().validateDraw("mega-sena", [1, 2, 3, 4, 5, 61]),
    ).toThrow());
});