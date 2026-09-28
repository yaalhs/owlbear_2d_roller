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
  readonly unselectedValues?: readonly string[];
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
export interface DiceAdvantageSelection {
  readonly mode: AdvantageMode;
  readonly count: number;
}
export interface AdvantageSettings {
  d20?: AdvantageMode;
  plot?: AdvantageMode;
  dice?: Readonly<Record<string, DiceAdvantageSelection>>;
}

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
      if (candidate === "d20") delete next.d20;
      else delete next.plot;
    }
  }
  if (next.dice && Object.values(next.dice).some((selection) => selection.mode !== mode)) {
    delete next.dice;
  }
  next[target] = mode;
  return next;
}

export function setDiceAdvantageSelection(
  selections: AdvantageSettings,
  dieId: string,
  mode: AdvantageMode,
  count: number,
): AdvantageSettings {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("Advantage count must be a non-negative whole number.");
  }

  const next: AdvantageSettings = { ...selections };
  const current = selections.dice?.[dieId];
  if (count === 0) {
    if (!current) return next;
    const dice = { ...selections.dice };
    delete dice[dieId];
    if (Object.keys(dice).length > 0) next.dice = dice;
    else delete next.dice;
    return next;
  }

  const hasOppositeMode =
    (next.d20 !== undefined && next.d20 !== mode) ||
    (next.plot !== undefined && next.plot !== mode) ||
    Object.values(next.dice ?? {}).some(
      (selection) => selection.mode !== mode,
    );
  if (hasOppositeMode) {
    delete next.d20;
    delete next.plot;
    delete next.dice;
  }

  next.dice = {
    ...next.dice,
    [dieId]: { mode, count },
  };
  return next;
}

export function getVisibleDieCount(results: readonly RolledDie[]): number {
  return results.reduce(
    (count, result) =>
      count +
      1 +
      (result.unselectedValue === undefined ? 0 : 1) +
      (result.unselectedValues?.length ?? 0),
    0,
  );
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
  if (!isAdvantageSettings(advantage)) {
    throw new RangeError(
      "A roll has invalid Advantage or Disadvantage settings.",
    );
  }

  let totalDice = 0;
  if (
    Object.keys(advantage.dice ?? {}).some(
      (dieId) => !dice.some((die) => die.id === dieId),
    )
  ) {
    throw new RangeError("Advantage or Disadvantage references an unknown die.");
  }
  for (const die of dice) {
    const quantity = quantities[die.id] ?? 0;
    const diceSelection = advantage.dice?.[die.id];
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > MAX_DICE_PER_TYPE
    ) {
      throw new RangeError(
        `Quantity for ${die.id} must be a whole number from 0 to ${MAX_DICE_PER_TYPE}.`,
      );
    }
    if (
      diceSelection &&
      (die.id === "d20" ||
        die.id === "plot" ||
        diceSelection.count > quantity)
    ) {
      throw new RangeError(
        `Advantage or Disadvantage for ${die.id} cannot exceed its selected dice.`,
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
    const diceSelection = advantage.dice?.[die.id];
    if (diceSelection) {
      const candidates = Array.from(
        { length: quantity + diceSelection.count },
        () => rollFace(die, random),
      ).sort((first, second) => {
        const difference =
          getAdvantageRank(die, first.value) -
          getAdvantageRank(die, second.value);
        return diceSelection.mode === "advantage" ? -difference : difference;
      });
      const selectedFaces = candidates.slice(0, quantity);
      const unselectedValues = candidates
        .slice(quantity)
        .map((face) => face.value);
      for (const [index, face] of selectedFaces.entries()) {
        results.push({
          dieId: die.id,
          value: face.value,
          ...(index === 0 && unselectedValues.length > 0
            ? { unselectedValues }
            : {}),
        });
      }
      continue;
    }

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
      const firstRank = getAdvantageRank(die, firstFace.value);
      const secondRank = getAdvantageRank(die, secondFace.value);
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

function getAdvantageRank(die: DieDefinition, value: string): number {
  if (die.id === "plot") {
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
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  return die.faces.findIndex((face) => face.value === value);
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
          typeof rolledDie.unselectedValue === "string") &&
        (rolledDie.unselectedValues === undefined ||
          (Array.isArray(rolledDie.unselectedValues) &&
            rolledDie.unselectedValues.every(
              (value) => typeof value === "string",
            )))
      );
    });
  });
}

function isAdvantageSettings(value: unknown): value is AdvantageSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const settings = value as Record<string, unknown>;
  if (
    Object.keys(settings).some(
      (key) => key !== "d20" && key !== "plot" && key !== "dice",
    )
  ) return false;

  const modes: AdvantageMode[] = [];
  for (const target of ["d20", "plot"] as const) {
    const mode = settings[target];
    if (mode !== undefined) {
      if (mode !== "advantage" && mode !== "disadvantage") return false;
      modes.push(mode);
    }
  }

  const dice = settings.dice;
  if (dice !== undefined) {
    if (typeof dice !== "object" || dice === null || Array.isArray(dice)) {
      return false;
    }
    for (const [dieId, selection] of Object.entries(dice)) {
      if (
        !dieId ||
        typeof selection !== "object" ||
        selection === null ||
        Array.isArray(selection)
      ) {
        return false;
      }
      const candidate = selection as Record<string, unknown>;
      if (
        (candidate.mode !== "advantage" &&
          candidate.mode !== "disadvantage") ||
        !Number.isInteger(candidate.count) ||
        (candidate.count as number) <= 0
      ) {
        return false;
      }
      modes.push(candidate.mode);
    }
  }
  return new Set(modes).size <= 1;
}
