export const PALETTE_STORAGE_KEY = "com.dieroller.shared-dice-roller/palette";

export const PALETTE_NAMES = [
  "default",
  "duskvol",
  "mistborn",
  "stormlight",
] as const;

export type PaletteName = (typeof PALETTE_NAMES)[number];

export function isPaletteName(value: string | null): value is PaletteName {
  return PALETTE_NAMES.some((palette) => palette === value);
}

export function readSavedPalette(): PaletteName {
  const savedPalette = localStorage.getItem(PALETTE_STORAGE_KEY);
  return isPaletteName(savedPalette) ? savedPalette : "default";
}

export function applyPalette(
  palette: PaletteName,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.palette = palette;
}

export function savePalette(palette: PaletteName): void {
  localStorage.setItem(PALETTE_STORAGE_KEY, palette);
}
