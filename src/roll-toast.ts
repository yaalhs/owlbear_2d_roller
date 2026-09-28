import OBR from "@owlbear-rodeo/sdk";
import {
  findDie,
  getDieShapeArt,
} from "./catalog";
import { createDieResult } from "./die-result";
import {
  getPlotDieBonus,
  getPlotweaverBreakdown,
  formatRollSubtitle,
  getVisibleDieCount,
  getRollTotal,
  parseSharedRolls,
  sumNumericResults,
} from "./rolls";
import type { AdvantageMode, AdvantageTarget } from "./rolls";
import "./font.css";
import "./die-graphic.css";
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
  const rollSubtitle = formatRollSubtitle(roll.results);
  const visibleDieCount = getVisibleDieCount(roll.results);
  const popupTitle = `Roll · ${visibleDieCount} ${visibleDieCount === 1 ? "die" : "dice"}`;
  document.title = "Dice roll";
  root.setAttribute("aria-label", `${popupTitle}: ${rollSubtitle}. Click to open shared roll history.`);

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
  heading.title = "Click to open shared roll history";

  const subtitle = document.createElement("span");
  subtitle.className = "toast-subtitle";
  subtitle.textContent = rollSubtitle;
  subtitle.title = rollSubtitle;

  const faces = document.createElement("div");
  faces.className = "toast-faces";
  const markedTargets = new Set<AdvantageTarget>();
  for (const result of roll.results) {
    const target: AdvantageTarget | undefined =
      result.dieId === "d20" || result.dieId === "plot"
        ? result.dieId
        : undefined;
    const mode =
      target && !markedTargets.has(target) ? roll.advantage?.[target] : undefined;
    if (target && mode) markedTargets.add(target);
    const dieMode =
      mode ??
      (!target ? roll.advantage?.dice?.[result.dieId]?.mode : undefined);
    faces.append(createToastFaceTile(result.dieId, result.value, dieMode));
    if (result.unselectedValue !== undefined) {
      faces.append(
        createToastFaceTile(
          result.dieId,
          result.unselectedValue,
          undefined,
          true,
        ),
      );
    }
    for (const unselectedValue of result.unselectedValues ?? []) {
      faces.append(
        createToastFaceTile(
          result.dieId,
          unselectedValue,
          undefined,
          true,
        ),
      );
    }
  }
  const faceCount = getVisibleDieCount(roll.results);
  faces.dataset.rows = String(Math.min(3, Math.max(1, Math.ceil(faceCount / 5))));
  faces.dataset.compact = String(faceCount > 15);

  const total = document.createElement("span");
  total.className = "toast-total";
  const breakdown = getPlotweaverBreakdown(roll);
  total.textContent =
    roll.mode === "plotweaver" && breakdown.hasD20 && breakdown.hasOtherDice
      ? `d20 + Plot + modifier ${breakdown.d20AndPlot} · Hit ${breakdown.hit} · Graze ${breakdown.graze} · Total ${breakdown.total}`
      : roll.mode === "plotweaver" && breakdown.hasD20
        ? `d20 + Plot + modifier ${breakdown.d20AndPlot} · Total ${breakdown.total}`
        : roll.modifier
          ? `Total ${getRollTotal(roll)} (${sumNumericResults(roll.results) + getPlotDieBonus(roll.results)} ${roll.modifier > 0 ? "+" : "−"} ${Math.abs(roll.modifier)})`
          : `Total ${getRollTotal(roll)}`;
  root.append(heading, subtitle, faces, total);
}

function createToastFaceTile(
  dieId: string,
  value: string,
  mode?: AdvantageMode,
  unselected = false,
): HTMLElement {
  const die = findDie(dieId);
  const face = die?.faces.find((candidate) => candidate.value === value);
  const tile = document.createElement("span");
  tile.className = "toast-face";
  tile.classList.toggle("toast-face-unselected", unselected);
  tile.title = unselected
    ? `${die?.name ?? dieId} (not selected): ${value}`
    : `${die?.name ?? dieId}${mode ? ` (${mode}; kept ${mode === "advantage" ? "higher" : "lower"})` : ""}: ${value}`;
  const graphic = document.createElement("span");
  graphic.className = "die-graphic";

  if (die) {
    graphic.dataset.shape = die.shape;
    graphic.classList.toggle("plot-die-graphic", die.id === "plot");

    const shape = document.createElement("img");
    shape.className = "die-shape-art";
    shape.src = getDieShapeArt(die.shape);
    shape.alt = "";
    shape.setAttribute("aria-hidden", "true");
    graphic.append(shape);

    if (face?.art) {
      const art = document.createElement("img");
      art.className = "die-face-art";
      art.src = face.art;
      art.alt = "";
      art.addEventListener("error", () => art.remove());
      graphic.append(art);
    }
  }

  const faceValue = createDieResult(dieId, value);
  if (die?.id === "plot" && value.startsWith("Complication")) {
    faceValue.classList.add("die-result-complication");
  }
  if (!(die?.id === "d6" && face?.art)) graphic.append(faceValue);
  tile.append(graphic);
  if (mode) {
    const marker = document.createElement("span");
    marker.className = "die-mode-marker";
    marker.textContent = mode === "advantage" ? "Adv" : "Dis";
    marker.setAttribute("aria-label", mode);
    tile.append(marker);
  }
  return tile;
}
