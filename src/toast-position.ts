export const TOAST_WIDTH = 320;
export const TOAST_HEIGHT = 136;
export const TOAST_GAP = 12;
const TOAST_SUBTITLE_CHARS_PER_LINE = 48;
const TOAST_SUBTITLE_LINE_HEIGHT = 14;

export function getToastHeight(subtitle: string): number {
  const lines = Math.max(1, Math.ceil(subtitle.length / TOAST_SUBTITLE_CHARS_PER_LINE));
  return TOAST_HEIGHT + (lines - 1) * TOAST_SUBTITLE_LINE_HEIGHT;
}

export function getToastAnchorPosition(
  viewportWidth: number,
  viewportHeight: number,
  offsetFromBottom: number,
  toastHeight = TOAST_HEIGHT,
): { left: number; top: number } {
  return {
    left: Math.max(TOAST_WIDTH, viewportWidth - 12),
    top: Math.max(toastHeight, viewportHeight - 12 - offsetFromBottom),
  };
}
