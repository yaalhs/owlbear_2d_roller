import { describe, expect, it } from "vitest";
import {
  DICE_CATALOG,
  displayDieFaceValue,
  getDieShapeArt,
} from "./catalog";
import {
  formatRollSubtitle,
  getPlotDieBonus,
  getPlotweaverBreakdown,
  getVisibleDieCount,
  getRollTotal,
  parseSharedRolls,
  rollDice,
  sumNumericResults,
  setDiceAdvantageSelection,
  toggleAdvantageSelection,
} from "./rolls";
import type { DieDefinition } from "./catalog";
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

  it("keeps the higher or lower d20 roll for one selected d20", () => {
    const samples = [0, 0.95, 0.45];
    let sampleIndex = 0;
    const random = () => samples[sampleIndex++];

    expect(
      rollDice(DICE_CATALOG, { d20: 2 }, random, { d20: "advantage" }),
    ).toEqual([
      { dieId: "d20", value: "20", unselectedValue: "1" },
      { dieId: "d20", value: "10" },
    ]);
    expect(sampleIndex).toBe(3);

    const disadvantageSamples = [0, 0.95];
    let disadvantageIndex = 0;
    expect(
      rollDice(
        DICE_CATALOG,
        { d20: 1 },
        () => disadvantageSamples[disadvantageIndex++],
        { d20: "disadvantage" },
      ),
    ).toEqual([{ dieId: "d20", value: "1", unselectedValue: "20" }]);
  });

  it("keeps the highest selected dice after adding one Advantage die per point", () => {
    const samples = [0.99, 0, 0.5];
    let sampleIndex = 0;

    expect(
      rollDice(
        DICE_CATALOG,
        { d6: 2 },
        () => samples[sampleIndex++],
        { dice: { d6: { mode: "advantage", count: 1 } } },
      ),
    ).toEqual([
      { dieId: "d6", value: "6", unselectedValues: ["1"] },
      { dieId: "d6", value: "4" },
    ]);
    expect(sampleIndex).toBe(3);
  });

  it("keeps the lowest selected dice and supports multiple Advantage dice", () => {
    const samples = [0, 0.2, 0.6, 0.99];
    let sampleIndex = 0;

    expect(
      rollDice(
        DICE_CATALOG,
        { d6: 2 },
        () => samples[sampleIndex++],
        { dice: { d6: { mode: "disadvantage", count: 2 } } },
      ),
    ).toEqual([
      { dieId: "d6", value: "1", unselectedValues: ["4", "6"] },
      { dieId: "d6", value: "2" },
    ]);
  });

  it("applies dice Advantage to each selected kind independently", () => {
    const samples = [0, 0.99, 0, 0.99];
    let sampleIndex = 0;
    const results = rollDice(
      DICE_CATALOG,
      { d4: 1, d8: 1 },
      () => samples[sampleIndex++],
      {
        dice: {
          d4: { mode: "advantage", count: 1 },
          d8: { mode: "advantage", count: 1 },
        },
      },
    );

    expect(results).toEqual([
      { dieId: "d4", value: "4", unselectedValues: ["1"] },
      { dieId: "d8", value: "8", unselectedValues: ["1"] },
    ]);
  });

  it("uses catalog face order for Advantage on custom symbol dice", () => {
    const symbolDie: DieDefinition = {
      id: "fate",
      name: "Fate die",
      shape: "cube",
      faces: [{ value: "−" }, { value: "+" }, { value: "blank" }],
    };
    const samples = [0, 0.5];
    let sampleIndex = 0;

    expect(
      rollDice(
        [symbolDie],
        { fate: 1 },
        () => samples[sampleIndex++],
        { dice: { fate: { mode: "advantage", count: 1 } } },
      ),
    ).toEqual([
      { dieId: "fate", value: "+", unselectedValues: ["−"] },
    ]);
  });

  it("keeps the better or worse Plot face in the requested outcome order", () => {
    const plot = DICE_CATALOG.find((die) => die.id === "plot");
    expect(plot?.faces.map((face) => face.value)).toEqual([
      "Opportunity",
      "Opportunity",
      "Blank",
      "Blank",
      "Complication +4",
      "Complication +2",
    ]);
    const samples = [0.99, 0];
    let sampleIndex = 0;
    const random = () => samples[sampleIndex++];

    expect(
      rollDice(DICE_CATALOG, { plot: 1 }, random, { plot: "advantage" }),
    ).toEqual([
      {
        dieId: "plot",
        value: "Opportunity",
        unselectedValue: "Complication +2",
      },
    ]);
    sampleIndex = 0;
    expect(
      rollDice(DICE_CATALOG, { plot: 1 }, random, { plot: "disadvantage" }),
    ).toEqual([
      {
        dieId: "plot",
        value: "Complication +2",
        unselectedValue: "Opportunity",
      },
    ]);
  });

  it("rejects contradictory advantage settings on a single roll", () => {
    expect(() =>
      rollDice(
        DICE_CATALOG,
        { d20: 1, plot: 1 },
        Math.random,
        { d20: "advantage", plot: "disadvantage" },
      ),
    ).toThrow(RangeError);
  });

  it("rejects an Advantage count greater than the selected dice", () => {
    expect(() =>
      rollDice(
        DICE_CATALOG,
        { d6: 1 },
        Math.random,
        { dice: { d6: { mode: "advantage", count: 2 } } },
      ),
    ).toThrow(RangeError);
  });

  it("rejects invalid quantities and random samples", () => {
    expect(() => rollDice(DICE_CATALOG, { d6: 1.5 })).toThrow(RangeError);
    expect(() => rollDice(DICE_CATALOG, { d6: 21 })).toThrow(RangeError);
    expect(() => rollDice(DICE_CATALOG, { d6: 11, d20: 10 })).toThrow(RangeError);
    expect(() => rollDice(DICE_CATALOG, { d6: 1 }, () => 1)).toThrow(RangeError);
  });
});

describe("toggleAdvantageSelection", () => {
  it("allows the same mode on d20 and Plot, but removes the opposite mode", () => {
    expect(
      toggleAdvantageSelection(
        { d20: "advantage" },
        "plot",
        "advantage",
      ),
    ).toEqual({ d20: "advantage", plot: "advantage" });

    expect(
      toggleAdvantageSelection(
        { d20: "advantage", plot: "advantage" },
        "plot",
        "disadvantage",
      ),
    ).toEqual({ plot: "disadvantage" });
  });

  it("toggles the selected mode off", () => {
    expect(
      toggleAdvantageSelection(
        { d20: "disadvantage" },
        "d20",
        "disadvantage",
      ),
    ).toEqual({});
  });

  it("removes dice settings in the opposite mode", () => {
    expect(
      setDiceAdvantageSelection(
        {
          d20: "disadvantage",
          dice: { d6: { mode: "disadvantage", count: 1 } },
        },
        "d8",
        "advantage",
        1,
      ),
    ).toEqual({
      dice: { d8: { mode: "advantage", count: 1 } },
    });
  });
});

describe("parseSharedRolls", () => {
  it("keeps only structurally valid shared rolls", () => {
    const rolls = parseSharedRolls([
      {
        id: "roll-1",
        timestamp: "2026-01-01T00:00:00.000Z",
        results: [
          { dieId: "d6", value: "3" },
          {
            dieId: "d20",
            value: "18",
            unselectedValue: "9",
          },
          {
            dieId: "d6",
            value: "6",
            unselectedValues: ["1", "2"],
          },
        ],
        advantage: {
          d20: "advantage",
          plot: "advantage",
          dice: { d6: { mode: "advantage", count: 2 } },
        },
      },
      { id: "broken", results: "not results" },
      {
        id: "mixed",
        timestamp: "2026-01-01T00:00:00.000Z",
        results: [],
        advantage: { d20: "advantage", plot: "disadvantage" },
      },
      {
        id: "invalid-target",
        timestamp: "2026-01-01T00:00:00.000Z",
        results: [],
        advantage: { d6: "advantage" },
      },
    ]);

    expect(rolls).toHaveLength(1);
    expect(rolls[0].results[0]).toEqual({ dieId: "d6", value: "3" });
    expect(rolls[0].results[1]).toEqual({
      dieId: "d20",
      value: "18",
      unselectedValue: "9",
    });
    expect(rolls[0].results[2].unselectedValues).toEqual(["1", "2"]);
    expect(rolls[0].advantage).toEqual({
      d20: "advantage",
      plot: "advantage",
      dice: { d6: { mode: "advantage", count: 2 } },
    });
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
    ).toBe(5);
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

  it("applies modifier to d20 + Plot and Hit while keeping Graze unmodified", () => {
    expect(getPlotweaverBreakdown(roll)).toEqual({
      d20AndPlot: 18,
      otherDice: 7,
      hit: 8,
      graze: 7,
      total: 26,
      hasD20: true,
      hasOtherDice: true,
    });
  });

  it("regular total includes all dice, modifier and Plot complications", () => {
    expect(getRollTotal(roll)).toBe(25);
  });

  it("applies a negative modifier to both Plotweaver components", () => {
    expect(
      getPlotweaverBreakdown({
        results: [
          { dieId: "d20", value: "15" },
          { dieId: "plot", value: "Complication +2" },
          { dieId: "d6", value: "4" },
        ],
        modifier: -2,
      }),
    ).toMatchObject({
      d20AndPlot: 15,
      hit: 2,
      graze: 4,
      total: 17,
    });
  });

  it("shows the modifier in d20 + Plot when no other dice are rolled", () => {
    expect(
      getPlotweaverBreakdown({
        results: [
          { dieId: "d20", value: "15" },
          { dieId: "plot", value: "Complication +2" },
        ],
        modifier: 3,
      }),
    ).toEqual({
      d20AndPlot: 20,
      otherDice: 0,
      hit: 3,
      graze: 0,
      total: 20,
      hasD20: true,
      hasOtherDice: false,
    });
  });
});

describe("Plot die", () => {
  it("has the requested six equally likely outcomes", () => {
    expect(DICE_CATALOG.find((die) => die.id === "plot")?.faces.map((face) => face.value)).toEqual([
      "Opportunity",
      "Opportunity",
      "Blank",
      "Blank",
      "Complication +4",
      "Complication +2",
    ]);
  });

  it("formats symbolic Plot results as ordinary text", () => {
    expect(displayDieFaceValue("plot", "Opportunity")).toBe("O");
    expect(displayDieFaceValue("plot", "Complication +2")).toBe("C +2");
    expect(displayDieFaceValue("plot", "Complication +4")).toBe("C +4");
    expect(displayDieFaceValue("plot", "Blank")).toBe("—");
    expect(displayDieFaceValue("d20", "20")).toBe("20");
  });
});

describe("die silhouettes", () => {
  it("defines a matching polyhedron silhouette for every catalog die", () => {
    expect(DICE_CATALOG.map(({ id, shape }) => [id, shape])).toEqual([
      ["d4", "tetrahedron"],
      ["d6", "cube"],
      ["d8", "octahedron"],
      ["d10", "trapezohedron"],
      ["d12", "dodecahedron"],
      ["d20", "icosahedron"],
      ["plot", "cube"],
    ]);
  });

  it("maps each silhouette to its own artwork file", () => {
    for (const die of DICE_CATALOG) {
      expect(getDieShapeArt(die.shape)).toContain(
        `/die-shapes/${die.shape}.svg`,
      );
    }
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

  it("grows the pop-up to show all wrapped dice faces", () => {
    expect(getToastHeight("roll", 5)).toBe(136);
    expect(getToastHeight("roll", 7)).toBe(176);
    expect(getToastHeight("roll", 11)).toBe(216);
    expect(getToastHeight("roll", 16)).toBe(184);
    expect(getToastHeight("roll", 40)).toBe(184);
  });

  it("counts every kept and discarded candidate die", () => {
    expect(
      getVisibleDieCount([
        { dieId: "d6", value: "6", unselectedValues: ["1", "2"] },
        { dieId: "d20", value: "20", unselectedValue: "1" },
      ]),
    ).toBe(6);
  });
});
