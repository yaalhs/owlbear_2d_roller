export interface DieFace {
  readonly value: string;
  readonly art?: string;
}

export interface DieDefinition {
  readonly id: string;
  readonly name: string;
  readonly shape: DieShape;
  readonly faces: readonly DieFace[];
}

export type DieShape =
  | "tetrahedron"
  | "cube"
  | "octahedron"
  | "trapezohedron"
  | "dodecahedron"
  | "icosahedron";

const DIE_SHAPE_ART: Record<DieShape, string> = {
  tetrahedron: new URL("./die-shapes/tetrahedron.svg", import.meta.url).href,
  cube: new URL("./die-shapes/cube.svg", import.meta.url).href,
  octahedron: new URL("./die-shapes/octahedron.svg", import.meta.url).href,
  trapezohedron: new URL("./die-shapes/trapezohedron.svg", import.meta.url).href,
  dodecahedron: new URL("./die-shapes/dodecahedron.svg", import.meta.url).href,
  icosahedron: new URL("./die-shapes/icosahedron.svg", import.meta.url).href,
};

export function getDieShapeArt(shape: DieShape): string {
  return DIE_SHAPE_ART[shape];
}

function numberedDie(
  id: string,
  sides: number,
  shape: DieShape,
): DieDefinition {
  return {
    id,
    name: `d${sides}`,
    shape,
    faces: Array.from({ length: sides }, (_, index) => ({
      value: String(index + 1),
    })),
  };
}

export const DICE_CATALOG: readonly DieDefinition[] = [
  numberedDie("d4", 4, "tetrahedron"),
  {
    id: "d6",
    name: "d6",
    shape: "cube",
    faces: Array.from({ length: 6 }, (_, index) => ({
      value: String(index + 1),
      art: `./art/dice/d6/${index + 1}.svg`,
    })),
  },
  numberedDie("d8", 8, "octahedron"),
  numberedDie("d10", 10, "trapezohedron"),
  numberedDie("d12", 12, "dodecahedron"),
  numberedDie("d20", 20, "icosahedron"),
  {
    id: "plot",
    name: "Plot die",
    shape: "cube",
    faces: [
      { value: "Opportunity" },
      { value: "Opportunity" },
      { value: "Blank" },
      { value: "Blank" },
      { value: "Complication +4" },
      { value: "Complication +2" },
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
