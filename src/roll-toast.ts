import OBR from "@owlbear-rodeo/sdk";
import { findDie } from "./catalog";
import {
  getPlotDieBonus,
  getPlotweaverBreakdown,
  getRollTotal,
  parseSharedRolls,
  sumNumericResults,
} from "./rolls";
import "./toast.css";

const root = document.getElementById("roll-toast");
if (!(root instanceof HTMLElement)) {
  throw new Error('Required page element "#roll-toast" was not found.');
}

const rollParam = new URLSearchParams(window.location.search).get("roll");
let roll: ReturnType<typeof parseSharedRolls>[number] | undefined;
try {
  roll = rollParam ? parseSharedRolls([JSON.parse(rollParam)])[0] : undefined;
} catch (error) {
  console.error("Could not read the dice roll pop-up data.", error);
}

if (!roll) {
  root.textContent = "Dice roll unavailable";
} else {
  root.setAttribute("role", "button");
  root.tabIndex = 0;
  root.setAttribute("aria-label", "Open shared roll history");
  root.title = "Click to open shared roll history";
  const rollTitle = roll.results
    .map((result) => {
      const die = findDie(result.dieId);
      return `${die?.name ?? result.dieId}: ${result.value}`;
    })
    .join(", ");
  const popupTitle = `Dice rolled · ${rollTitle}`;
  document.title = popupTitle;
  root.setAttribute("aria-label", `${popupTitle}. Click to open shared roll history.`);

  const openHistory = () => {
    OBR.onReady(() => {
      void (async () => {
        const viewportWidth = await OBR.viewport.getWidth();
        const viewportHeight = await OBR.viewport.getHeight();
        const historyUrl = new URL("./index.html?history=1", window.location.href);
        await OBR.popover.open({
          id: "com.dieroller.shared-dice-roller/roll-history",
          url: historyUrl.href,
          width: 360,
          height: 560,
          anchorReference: "POSITION",
          anchorPosition: {
            left: Math.max(360, viewportWidth - 12),
            top: Math.max(560, viewportHeight - 12),
          },
          anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
          transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
        });
        const toastId = new URLSearchParams(window.location.search).get("toastId");
        if (toastId) await OBR.popover.close(toastId);
      })().catch((error: unknown) => {
        console.error("Could not open the shared roll history.", error);
      });
    });
  };
  root.addEventListener("click", openHistory);
  root.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openHistory();
    }
  });

  const heading = document.createElement("strong");
  heading.className = "toast-heading";
  heading.textContent = popupTitle;
  heading.title = popupTitle;

  const faces = document.createElement("div");
  faces.className = "toast-faces";
  for (const result of roll.results) {
    const die = findDie(result.dieId);
    const face = die?.faces.find((candidate) => candidate.value === result.value);
    const tile = document.createElement("span");
    tile.className = die?.id === "plot" ? "toast-face toast-face-plot" : "toast-face";
    tile.title = `${die?.name ?? result.dieId}: ${result.value}`;

    if (face?.art) {
      const image = document.createElement("img");
      image.src = face.art;
      image.alt = "";
      image.addEventListener("error", () => image.remove());
      tile.append(image);
    }

    const value = document.createElement("span");
    value.textContent =
      result.value === "Opportunity"
        ? "Oppty"
        : result.value === "Blank"
          ? "—"
          : result.value.replace("Complication ", "C");
    tile.append(value);
    faces.append(tile);
  }

  const total = document.createElement("span");
  total.className = "toast-total";
  const breakdown = getPlotweaverBreakdown(roll);
  total.textContent =
    roll.mode === "plotweaver" && breakdown.hasD20 && breakdown.hasOtherDice
      ? `d20 + Plot + mod ${breakdown.d20AndPlot} · Other ${breakdown.otherDice} · Total ${breakdown.total}`
      : roll.modifier
        ? `Total ${getRollTotal(roll)} (${sumNumericResults(roll.results) + getPlotDieBonus(roll.results)} ${roll.modifier > 0 ? "+" : "−"} ${Math.abs(roll.modifier)})`
        : `Total ${getRollTotal(roll)}`;
  root.append(heading, faces, total);
}
