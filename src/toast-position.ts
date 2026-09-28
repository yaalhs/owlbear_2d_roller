export const TOAST_WIDTH = 320;
export const TOAST_HEIGHT = 136;
export const TOAST_GAP = 12;
const TOAST_SUBTITLE_CHARS_PER_LINE = 48;
const TOAST_SUBTITLE_LINE_HEIGHT = 14;
const TOAST_FACE_ROW_HEIGHT = 49;
const TOAST_COMPACT_FACE_ROW_HEIGHT = 24;

export function getToastHeight(subtitle: string, faceCount = 0): number {
  const lines = Math.max(1, Math.ceil(subtitle.length / TOAST_SUBTITLE_CHARS_PER_LINE));
  const compact = faceCount > 15;
  const faceRows = faceCount > 10 ? 3 : faceCount > 5 ? 2 : 1;
  const faceRowHeight = compact
    ? TOAST_COMPACT_FACE_ROW_HEIGHT
    : TOAST_FACE_ROW_HEIGHT;
  return (
    TOAST_HEIGHT +
    (lines - 1) * TOAST_SUBTITLE_LINE_HEIGHT +
    (faceRows - 1) * faceRowHeight
  );
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
