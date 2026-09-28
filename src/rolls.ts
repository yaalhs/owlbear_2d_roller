import {
  displayDieFaceValue,
  findDie,
  MAX_DICE_PER_ROLL,
  MAX_DICE_PER_TYPE,
} from "./catalog";
import type { DieDefinition } from "./catalog";

export const ROLL_BROADCAST_CHANNEL = "com.dieroller.shared-dice-roller/roll";

export interface RolledDie {
  readonly dieId: string;
  readonly value: string;
  readonly unselectedValue?: string;
}

export interface SharedRoll {
  readonly id: string;
  readonly timestamp: string;
  readonly results: readonly RolledDie[];
  readonly modifier?: number;
  readonly mode?: RollMode;
  readonly advantage?: AdvantageSettings;
}

export type RollMode = "plotweaver" | "regular";
export type AdvantageTarget = "d20" | "plot";
export type AdvantageMode = "advantage" | "disadvantage";
export type AdvantageSettings = Partial<
  Record<AdvantageTarget, AdvantageMode>
>;

export function toggleAdvantageSelection(
  selections: AdvantageSettings,
  target: AdvantageTarget,
  mode: AdvantageMode,
): AdvantageSettings {
  if (selections[target] === mode) {
    const next = { ...selections };
    delete next[target];
    return next;
  }

  const next: AdvantageSettings = { ...selections };
  for (const candidate of ["d20", "plot"] as const) {
    if (next[candidate] !== undefined && next[candidate] !== mode) {
      delete next[candidate];
    }
  }
  next[target] = mode;
  return next;
}

export function sumNumericResults(results: readonly RolledDie[]): number {
  return results.reduce((sum, result) => {
    const value = Number(result.value);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function formatRollSubtitle(results: readonly RolledDie[]): string {
  return results
    .map(
      (result) =>
        `${findDie(result.dieId)?.name ?? result.dieId}: ${displayDieFaceValue(result.dieId, result.value)}`,
    )
    .join(" · ");
}

export function getPlotDieBonus(results: readonly RolledDie[]): number {
  return results.reduce((bonus, result) => {
    if (result.dieId !== "plot") return bonus;
    const complication = /^Complication \+(\d+)$/.exec(result.value);
    return bonus + (complication ? Number(complication[1]) : 0);
  }, 0);
}

export function getRollTotal(
  roll: Pick<SharedRoll, "results" | "modifier">,
): number {
  return (
    sumNumericResults(roll.results) +
    getPlotDieBonus(roll.results) +
    (roll.modifier ?? 0)
  );
}

export interface PlotweaverBreakdown {
  readonly d20AndPlot: number;
  readonly otherDice: number;
  readonly hit: number;
  readonly graze: number;
  readonly total: number;
  readonly hasD20: boolean;
  readonly hasOtherDice: boolean;
}

export function getPlotweaverBreakdown(
  roll: Pick<SharedRoll, "results" | "modifier">,
): PlotweaverBreakdown {
  const d20Results = roll.results.filter((result) => result.dieId === "d20");
  const otherResults = roll.results.filter(
    (result) => result.dieId !== "d20" && result.dieId !== "plot",
  );
  const modifier = roll.modifier ?? 0;
  const d20AndPlot =
    sumNumericResults(d20Results) +
    getPlotDieBonus(roll.results) +
    modifier;
  const otherDice = sumNumericResults(otherResults);
  const hit = otherDice + modifier;
  const hasD20 = d20Results.length > 0;
  const hasOtherDice = otherResults.length > 0;

  return {
    d20AndPlot,
    otherDice,
    hit,
    graze: otherDice,
    total: hasD20 && hasOtherDice ? d20AndPlot + hit : getRollTotal(roll),
    hasD20,
    hasOtherDice,
  };
}

export function rollDice(
  dice: readonly DieDefinition[],
  quantities: Readonly<Record<string, number>>,
  random: () => number = Math.random,
  advantage: AdvantageSettings = {},
): RolledDie[] {
  const advantageModes = Object.values(advantage);
  if (
    Object.keys(advantage).some((target) => target !== "d20" && target !== "plot") ||
    advantageModes.some(
      (mode) => mode !== "advantage" && mode !== "disadvantage",
    ) ||
    new Set(advantageModes).size > 1
  ) {
    throw new RangeError(
      "A roll can use Advantage or Disadvantage, but not both.",
    );
  }

  let totalDice = 0;
  for (const die of dice) {
    const quantity = quantities[die.id] ?? 0;
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > MAX_DICE_PER_TYPE
    ) {
      throw new RangeError(
        `Quantity for ${die.id} must be a whole number from 0 to ${MAX_DICE_PER_TYPE}.`,
      );
    }
    totalDice += quantity;
  }
  if (totalDice > MAX_DICE_PER_ROLL) {
    throw new RangeError(`A roll cannot contain more than ${MAX_DICE_PER_ROLL} dice.`);
  }

  const results: RolledDie[] = [];

  for (const die of dice) {
    const quantity = quantities[die.id] ?? 0;

    for (let count = 0; count < quantity; count += 1) {
      const mode =
        count === 0
          ? die.id === "d20"
            ? advantage.d20
            : die.id === "plot"
              ? advantage.plot
              : undefined
          : undefined;
      const firstFace = rollFace(die, random);
      if (!mode) {
        results.push({ dieId: die.id, value: firstFace.value });
        continue;
      }

      const secondFace = rollFace(die, random);
      const firstRank = getAdvantageRank(die.id, firstFace.value);
      const secondRank = getAdvantageRank(die.id, secondFace.value);
      const keepHigher = mode === "advantage";
      const keptFace =
        (keepHigher && secondRank > firstRank) ||
        (!keepHigher && secondRank < firstRank)
          ? secondFace
          : firstFace;
      const unselectedFace = keptFace === firstFace ? secondFace : firstFace;
      results.push({
        dieId: die.id,
        value: keptFace.value,
        unselectedValue: unselectedFace.value,
      });
    }
  }

  return results;
}

function rollFace(
  die: DieDefinition,
  random: () => number,
): DieDefinition["faces"][number] {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError("Random source must return a number in the range [0, 1).");
  }
  return die.faces[Math.floor(sample * die.faces.length)];
}

function getAdvantageRank(dieId: string, value: string): number {
  if (dieId === "d20") return Number(value);
  if (dieId === "plot") {
    switch (value) {
      case "Opportunity":
        return 4;
      case "Blank":
        return 3;
      case "Complication +4":
        return 2;
      case "Complication +2":
        return 1;
    }
  }
  return 0;
}

export function parseSharedRolls(value: unknown): SharedRoll[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is SharedRoll => {
    if (typeof item !== "object" || item === null) return false;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.timestamp !== "string" ||
      !Array.isArray(candidate.results) ||
      (candidate.modifier !== undefined && !Number.isInteger(candidate.modifier)) ||
      (candidate.mode !== undefined &&
        candidate.mode !== "plotweaver" &&
        candidate.mode !== "regular") ||
      (candidate.advantage !== undefined &&
        !isAdvantageSettings(candidate.advantage))
    ) {
      return false;
    }

    return candidate.results.every((result: unknown) => {
      if (typeof result !== "object" || result === null) return false;
      const rolledDie = result as Record<string, unknown>;
      return (
        typeof rolledDie.dieId === "string" &&
        typeof rolledDie.value === "string" &&
        (rolledDie.unselectedValue === undefined ||
          typeof rolledDie.unselectedValue === "string")
      );
    });
  });
}

function isAdvantageSettings(value: unknown): value is AdvantageSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  if (
    entries.some(
      ([target, mode]) =>
        (target !== "d20" && target !== "plot") ||
        (mode !== "advantage" && mode !== "disadvantage"),
    )
  ) {
    return false;
  }
  return new Set(entries.map(([, mode]) => mode)).size <= 1;
}
