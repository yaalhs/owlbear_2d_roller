import { MAX_DICE_PER_ROLL, MAX_DICE_PER_TYPE } from "./catalog";
import type { DieDefinition } from "./catalog";

export const ROLL_BROADCAST_CHANNEL = "com.dieroller.shared-dice-roller/roll";

export interface RolledDie {
  readonly dieId: string;
  readonly value: string;
}

export interface SharedRoll {
  readonly id: string;
  readonly timestamp: string;
  readonly results: readonly RolledDie[];
  readonly modifier?: number;
  readonly mode?: RollMode;
}

export type RollMode = "plotweaver" | "regular";

export function sumNumericResults(results: readonly RolledDie[]): number {
  return results.reduce((sum, result) => {
    const value = Number(result.value);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
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
  const d20AndPlot =
    sumNumericResults(d20Results) +
    getPlotDieBonus(roll.results) +
    (roll.modifier ?? 0);
  const otherDice = sumNumericResults(otherResults);

  return {
    d20AndPlot,
    otherDice,
    total: d20AndPlot + otherDice,
    hasD20: d20Results.length > 0,
    hasOtherDice: otherResults.length > 0,
  };
}

export function rollDice(
  dice: readonly DieDefinition[],
  quantities: Readonly<Record<string, number>>,
  random: () => number = Math.random,
): RolledDie[] {
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
      const sample = random();
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new RangeError("Random source must return a number in the range [0, 1).");
      }

      const faceIndex = Math.floor(sample * die.faces.length);
      results.push({ dieId: die.id, value: die.faces[faceIndex].value });
    }
  }

  return results;
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
        candidate.mode !== "regular")
    ) {
      return false;
    }

    return candidate.results.every((result: unknown) => {
      if (typeof result !== "object" || result === null) return false;
      const rolledDie = result as Record<string, unknown>;
      return typeof rolledDie.dieId === "string" && typeof rolledDie.value === "string";
    });
  });
}
