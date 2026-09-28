export interface DieFace {
  readonly value: string;
  readonly art?: string;
}

export interface DieDefinition {
  readonly id: string;
  readonly name: string;
  readonly faces: readonly DieFace[];
}

function numberedDie(id: string, sides: number): DieDefinition {
  return {
    id,
    name: `d${sides}`,
    faces: Array.from({ length: sides }, (_, index) => ({
      value: String(index + 1),
    })),
  };
}

export const DICE_CATALOG: readonly DieDefinition[] = [
  numberedDie("d4", 4),
  {
    id: "d6",
    name: "d6",
    faces: Array.from({ length: 6 }, (_, index) => ({
      value: String(index + 1),
      art: `./art/dice/d6/${index + 1}.svg`,
    })),
  },
  numberedDie("d8", 8),
  numberedDie("d10", 10),
  numberedDie("d12", 12),
  numberedDie("d20", 20),
  {
    id: "plot",
    name: "Plot die",
    faces: [
      { value: "Opportunity" },
      { value: "Opportunity" },
      { value: "Blank" },
      { value: "Blank" },
      { value: "Complication +2" },
      { value: "Complication +4" },
    ],
  },
];

export const MAX_DICE_PER_TYPE = 20;
export const MAX_DICE_PER_ROLL = 20;

export function findDie(id: string): DieDefinition | undefined {
  return DICE_CATALOG.find((die) => die.id === id);
}

export function displayDieFaceValue(dieId: string, value: string): string {
  if (dieId !== "plot") return value;
  if (value === "Opportunity") return "O";
  if (value === "Blank") return "—";
  const complication = /^Complication \+([24])$/.exec(value);
  return complication ? `C +${complication[1]}` : value;
}
