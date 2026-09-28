export const TOAST_WIDTH = 320;
export const TOAST_HEIGHT = 136;
export const TOAST_GAP = 12;

export function getToastAnchorPosition(
  viewportWidth: number,
  viewportHeight: number,
  slot: number,
): { left: number; top: number } {
  return {
    left: Math.max(TOAST_WIDTH, viewportWidth - 12),
    top: Math.max(TOAST_HEIGHT, viewportHeight - 12 - slot * (TOAST_HEIGHT + TOAST_GAP)),
  };
}
