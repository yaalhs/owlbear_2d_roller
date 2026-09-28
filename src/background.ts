import OBR from "@owlbear-rodeo/sdk";
import {
  formatRollNotification,
  parseSharedRolls,
  ROLL_BROADCAST_CHANNEL,
} from "./rolls";

OBR.onReady(() => {
  OBR.broadcast.onMessage(ROLL_BROADCAST_CHANNEL, ({ data }) => {
    const [roll] = parseSharedRolls([data]);
    if (!roll) return;

    void OBR.notification
      .show(formatRollNotification(roll), "INFO")
      .catch((error: unknown) => {
        console.error("Could not show the shared dice roll notification.", error);
      });
  });
});
