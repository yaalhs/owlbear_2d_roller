import OBR from "@owlbear-rodeo/sdk";
import {
  formatRollSubtitle,
  parseSharedRolls,
  ROLL_BROADCAST_CHANNEL,
} from "./rolls";
import type { SharedRoll } from "./rolls";
import {
  getToastAnchorPosition,
  getToastHeight,
  TOAST_GAP,
  TOAST_WIDTH,
} from "./toast-position";

const TOAST_ID_PREFIX = "com.dieroller.shared-dice-roller/roll-toast";
const MAX_VISIBLE_TOASTS = 3;
const TOAST_DURATION_MS = 6000;

interface ActiveToast {
  readonly id: string;
  readonly height: number;
  readonly timeout: ReturnType<typeof setTimeout>;
}

const activeToasts: ActiveToast[] = [];
let queuedRolls = Promise.resolve();

async function showRollToast(roll: SharedRoll): Promise<void> {
  const viewportWidth = await OBR.viewport.getWidth();
  const viewportHeight = await OBR.viewport.getHeight();
  const id = `${TOAST_ID_PREFIX}/${roll.id}`;
  const height = getToastHeight(formatRollSubtitle(roll.results));
  const toastUrl = new URL("./roll-toast.html", window.location.href);
  toastUrl.searchParams.set("roll", JSON.stringify(roll));
  toastUrl.searchParams.set("toastId", id);

  while (activeToasts.length >= MAX_VISIBLE_TOASTS) {
    const oldest = activeToasts.shift();
    if (oldest) {
      clearTimeout(oldest.timeout);
      await OBR.popover.close(oldest.id);
    }
  }

  const offsetFromBottom = activeToasts.reduce(
    (offset, toast) => offset + toast.height + TOAST_GAP,
    0,
  );
  await OBR.popover.open({
    id,
    url: toastUrl.href,
    width: TOAST_WIDTH,
    height,
    anchorReference: "POSITION",
    anchorPosition: getToastAnchorPosition(
      viewportWidth,
      viewportHeight,
      offsetFromBottom,
      height,
    ),
    anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    hidePaper: true,
    disableClickAway: true,
  });

  const timeout = setTimeout(() => {
    const index = activeToasts.findIndex((toast) => toast.id === id);
    if (index !== -1) activeToasts.splice(index, 1);
    void OBR.popover.close(id).catch((error: unknown) => {
      console.error("Could not close the dice roll pop-up.", error);
    });
  }, TOAST_DURATION_MS);
  activeToasts.push({ id, height, timeout });
}

OBR.onReady(() => {
  OBR.broadcast.onMessage(ROLL_BROADCAST_CHANNEL, ({ data }) => {
    const [roll] = parseSharedRolls([data]);
    if (!roll) return;

    queuedRolls = queuedRolls
      .then(() => showRollToast(roll))
      .catch((error: unknown) => {
        console.error("Could not show the shared dice roll pop-up.", error);
      });
  });
});
