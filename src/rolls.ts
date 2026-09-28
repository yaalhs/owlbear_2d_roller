import {
  DICE_CATALOG,
  MAX_DICE_PER_ROLL,
  MAX_DICE_PER_TYPE,
} from "./catalog";
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
}

export function sumNumericResults(results: readonly RolledDie[]): number {
  return results.reduce((sum, result) => {
    const value = Number(result.value);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function formatRollNotification(roll: SharedRoll): string {
  const faces = roll.results.map((result) => {
    const die = DICE_CATALOG.find((candidate) => candidate.id === result.dieId);
    return `${die?.name ?? result.dieId} ${result.value}`;
  });
  return `Dice rolled: ${faces.join(", ")}. Total: ${sumNumericResults(roll.results)}`;
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
      !Array.isArray(candidate.results)
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
