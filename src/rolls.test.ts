import { describe, expect, it } from "vitest";
import { DICE_CATALOG } from "./catalog";
import { parseSharedRolls, rollDice, sumNumericResults } from "./rolls";

describe("rollDice", () => {
  it("rolls the requested number of dice with deterministic face selection", () => {
    const results = rollDice(
      DICE_CATALOG,
      { d6: 2, d20: 1 },
      () => 0.5,
    );

    expect(results).toEqual([
      { dieId: "d6", value: "4" },
      { dieId: "d6", value: "4" },
      { dieId: "d20", value: "11" },
    ]);
  });

  it("rejects invalid quantities and random samples", () => {
    expect(() => rollDice(DICE_CATALOG, { d6: 1.5 })).toThrow(RangeError);
    expect(() => rollDice(DICE_CATALOG, { d6: 21 })).toThrow(RangeError);
    expect(() => rollDice(DICE_CATALOG, { d6: 11, d20: 10 })).toThrow(RangeError);
    expect(() => rollDice(DICE_CATALOG, { d6: 1 }, () => 1)).toThrow(RangeError);
  });
});

describe("parseSharedRolls", () => {
  it("keeps only structurally valid shared rolls", () => {
    const rolls = parseSharedRolls([
      {
        id: "roll-1",
        timestamp: "2026-01-01T00:00:00.000Z",
        results: [{ dieId: "d6", value: "3" }],
      },
      { id: "broken", results: "not results" },
    ]);

    expect(rolls).toHaveLength(1);
    expect(rolls[0].results[0]).toEqual({ dieId: "d6", value: "3" });
    expect(parseSharedRolls("not an array")).toEqual([]);
  });
});

describe("sumNumericResults", () => {
  it("sums numeric faces and ignores symbol faces", () => {
    expect(
      sumNumericResults([
        { dieId: "d6", value: "4" },
        { dieId: "fate", value: "+" },
      ]),
    ).toBe(4);
  });
});
