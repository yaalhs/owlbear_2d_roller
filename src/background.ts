import OBR from "@owlbear-rodeo/sdk";
import { parseSharedRolls, ROLL_BROADCAST_CHANNEL } from "./rolls";
import type { SharedRoll } from "./rolls";
import {
  getToastAnchorPosition,
  TOAST_HEIGHT,
  TOAST_WIDTH,
} from "./toast-position";

const TOAST_ID_PREFIX = "com.dieroller.shared-dice-roller/roll-toast";
const MAX_VISIBLE_TOASTS = 3;
const TOAST_DURATION_MS = 6000;

interface ActiveToast {
  readonly id: string;
  readonly slot: number;
  readonly timeout: ReturnType<typeof setTimeout>;
}

const activeToasts: ActiveToast[] = [];
let queuedRolls = Promise.resolve();

async function showRollToast(roll: SharedRoll): Promise<void> {
  const viewportWidth = await OBR.viewport.getWidth();
  const viewportHeight = await OBR.viewport.getHeight();
  const id = `${TOAST_ID_PREFIX}/${roll.id}`;
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

  const occupiedSlots = new Set(activeToasts.map((toast) => toast.slot));
  const slot = Array.from({ length: MAX_VISIBLE_TOASTS }, (_, index) => index).find(
    (index) => !occupiedSlots.has(index),
  );
  if (slot === undefined) {
    throw new Error("No dice roll pop-up slot is available.");
  }
  await OBR.popover.open({
    id,
    url: toastUrl.href,
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
    anchorReference: "POSITION",
    anchorPosition: getToastAnchorPosition(viewportWidth, viewportHeight, slot),
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
  activeToasts.push({ id, slot, timeout });
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
