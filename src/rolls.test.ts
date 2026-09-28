import { describe, expect, it } from "vitest";
import { DICE_CATALOG, displayDieFaceValue } from "./catalog";
import {
  formatRollSubtitle,
  getPlotDieBonus,
  getPlotweaverBreakdown,
  getRollTotal,
  parseSharedRolls,
  rollDice,
  sumNumericResults,
} from "./rolls";
import { getToastAnchorPosition, getToastHeight } from "./toast-position";

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

describe("getRollTotal", () => {
  it("adds Plot die complications and a signed modifier", () => {
    expect(
      getRollTotal({
        results: [
          { dieId: "d6", value: "4" },
          { dieId: "plot", value: "Complication +2" },
          { dieId: "plot", value: "Opportunity" },
        ],
        modifier: -1,
      }),
    ).toBe(5);
  });
});

describe("getPlotDieBonus", () => {
  it("counts Complication +2 and +4 faces but not Opportunity or Blank", () => {
    expect(
      getPlotDieBonus([
        { dieId: "plot", value: "Complication +2" },
        { dieId: "plot", value: "Opportunity" },
        { dieId: "plot", value: "Complication +4" },
        { dieId: "plot", value: "Blank" },
      ]),
    ).toBe(6);
  });
});

describe("getPlotweaverBreakdown", () => {
  const roll = {
    results: [
      { dieId: "d20", value: "15" },
      { dieId: "plot", value: "Complication +2" },
      { dieId: "plot", value: "Opportunity" },
      { dieId: "d6", value: "4" },
      { dieId: "d8", value: "3" },
    ],
    modifier: 1,
  };

  it("applies modifier to other dice for Hit and reports their unmodified Graze", () => {
    expect(getPlotweaverBreakdown(roll)).toEqual({
      d20AndPlot: 17,
      otherDice: 7,
      hit: 8,
      graze: 7,
      total: 25,
      hasD20: true,
      hasOtherDice: true,
    });
  });

  it("regular total includes all dice, modifier and Plot complications", () => {
    expect(getRollTotal(roll)).toBe(25);
  });
});

describe("Plot die", () => {
  it("has the requested six equally likely outcomes", () => {
    expect(DICE_CATALOG.find((die) => die.id === "plot")?.faces.map((face) => face.value)).toEqual([
      "Opportunity",
      "Opportunity",
      "Blank",
      "Blank",
      "Complication +2",
      "Complication +4",
    ]);
  });

  it("uses the Cosmere Dingbats labels for its symbolic results", () => {
    expect(displayDieFaceValue("plot", "Opportunity")).toBe("O");
    expect(displayDieFaceValue("plot", "Complication +2")).toBe("C +2");
    expect(displayDieFaceValue("plot", "Complication +4")).toBe("C +4");
    expect(displayDieFaceValue("plot", "Blank")).toBe("—");
    expect(displayDieFaceValue("d20", "20")).toBe("20");
  });
});

describe("getToastAnchorPosition", () => {
  it("anchors the first roll pop-up to the bottom-right of the viewport", () => {
    expect(getToastAnchorPosition(1280, 800, 0)).toEqual({
      left: 1268,
      top: 788,
    });
  });

  it("stacks later pop-ups above earlier ones", () => {
    expect(getToastAnchorPosition(1280, 800, 148 + 12, 148).top).toBe(628);
  });
});

describe("roll pop-up sizing", () => {
  it("formats every die value in the subtitle", () => {
    expect(
      formatRollSubtitle([
        { dieId: "d20", value: "17" },
        { dieId: "plot", value: "Complication +4" },
      ]),
    ).toBe("d20: 17 · Plot die: C +4");
  });

  it("grows the pop-up to fit wrapped subtitle lines", () => {
    expect(getToastHeight("x".repeat(49))).toBe(150);
  });
});
