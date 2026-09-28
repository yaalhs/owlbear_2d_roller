import OBR from "@owlbear-rodeo/sdk";
import {
  DICE_CATALOG,
  findDie,
  getDieShapeArt,
  MAX_DICE_PER_ROLL,
  MAX_DICE_PER_TYPE,
} from "./catalog";
import type { DieDefinition, DieFace } from "./catalog";
import {
  getPlotDieBonus,
  getRollOutcomeCounts,
  getRollTotal,
  getPlotweaverBreakdown,
  getVisibleDieCount,
  parseSharedRolls,
  rollDice,
  ROLL_BROADCAST_CHANNEL,
  sumNumericResults,
  setDiceAdvantageSelection,
  toggleAdvantageSelection,
} from "./rolls";
import type {
  AdvantageMode,
  AdvantageSettings,
  AdvantageTarget,
  SharedRoll,
} from "./rolls";
import { createDieResult, createRollOutcomeSummary } from "./die-result";
import "./font.css";
import "./die-graphic.css";
import "./style.css";

const METADATA_KEY = "com.dieroller.shared-dice-roller/rolls";
const HISTORY_LIMIT = 12;

const diceList = requiredElement<HTMLDivElement>("dice-list");
const rollButton = requiredElement<HTMLButtonElement>("roll-button");
const historyList = requiredElement<HTMLOListElement>("roll-history");
const statusLabel = requiredElement<HTMLSpanElement>("connection-status");
const errorMessage = requiredElement<HTMLParagraphElement>("error-message");
const resultsCount = requiredElement<HTMLSpanElement>("results-count");
const modifierToggle = requiredElement<HTMLButtonElement>("modifier-toggle");
const modifierControls = requiredElement<HTMLDivElement>("modifier-controls");
const modifierValueOutput = requiredElement<HTMLOutputElement>("modifier-value");
const modifierMinus = requiredElement<HTMLButtonElement>("modifier-minus");
const modifierPlus = requiredElement<HTMLButtonElement>("modifier-plus");
const plotweaverModeButton = requiredElement<HTMLButtonElement>("plotweaver-mode");
const regularModeButton = requiredElement<HTMLButtonElement>("regular-mode");
const saveRollButton = requiredElement<HTMLButtonElement>("save-roll-button");
const quantitySelections = new Map<string, number>();
let advantageSelections: AdvantageSettings = {};

let roomReady = false;
let previewMode = new URLSearchParams(window.location.search).has("preview");
let visibleRolls: SharedRoll[] = [];
let modifier = 0;
let modifierEnabled = false;
let rollMode: "plotweaver" | "regular" = "plotweaver";
let keepSelection = false;

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Required page element "#${id}" was not found.`);
  }
  return element as T;
}

function buildDiceControls(): void {
  for (const die of DICE_CATALOG) {
    const row = document.createElement("div");
    row.className = "die-row";
    row.dataset.dieId = die.id;

    const identity = document.createElement("div");
    identity.className = "die-identity";

    const maximumFace =
      die.id === "plot"
        ? die.faces.find((face) => face.value === "Opportunity") ?? die.faces[0]
        : die.faces.reduce((maximum, face) =>
            Number(face.value) > Number(maximum.value) ? face : maximum,
          );
    const shape = createDieGraphic(die, maximumFace.value);
    shape.classList.add("die-shape-preview");
    shape.setAttribute("aria-hidden", "true");
    identity.append(shape);

    const description = document.createElement("span");
    description.className = "die-description";
    description.textContent = `${die.faces.length} faces`;

    const quantityControls = document.createElement("div");
    quantityControls.className = "quantity-controls";

    const minus = document.createElement("button");
    minus.className = "quantity-button";
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `Remove one ${die.name}`);

    const count = document.createElement("output");
    count.className = "quantity-value";
    count.textContent = "0";
    count.setAttribute("aria-label", `${die.name} selected`);

    const plus = document.createElement("button");
    plus.className = "quantity-button quantity-plus";
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Add one ${die.name}`);

    const changeQuantity = (amount: number) => {
      const current = quantitySelections.get(die.id) ?? 0;
      const total = [...quantitySelections.values()].reduce(
        (sum, quantity) => sum + quantity,
        0,
      );
      if (amount > 0 && (current >= MAX_DICE_PER_TYPE || total >= MAX_DICE_PER_ROLL)) return;
      quantitySelections.set(die.id, Math.max(0, current + amount));
      const nextQuantity = quantitySelections.get(die.id) ?? 0;
      const diceSelection = advantageSelections.dice?.[die.id];
      if (diceSelection && diceSelection.count > nextQuantity) {
        advantageSelections = setDiceAdvantageSelection(
          advantageSelections,
          die.id,
          diceSelection.mode,
          nextQuantity,
        );
      }
      count.textContent = String(quantitySelections.get(die.id));
      updateRollButton();
    };
    minus.addEventListener("click", () => changeQuantity(-1));
    plus.addEventListener("click", () => changeQuantity(1));

    quantityControls.append(minus, count, plus);
    row.append(identity, description, quantityControls);
    if (isAdvantageTarget(die.id)) {
      const target = die.id;
      const rollOptions = document.createElement("div");
      rollOptions.className = "die-roll-options";
      rollOptions.setAttribute("role", "group");
      rollOptions.setAttribute("aria-label", `${die.name} roll options`);
      for (const mode of ["advantage", "disadvantage"] as const) {
        const option = document.createElement("button");
        option.className = "die-roll-option";
        option.type = "button";
        option.dataset.advantageMode = mode;
        option.textContent = mode === "advantage" ? "Advantage" : "Disadvantage";
        option.setAttribute("aria-pressed", "false");
        option.addEventListener("click", () => setAdvantage(target, mode));
        rollOptions.append(option);
      }
      row.append(rollOptions);
    } else {
      row.append(createDiceAdvantageControls(die.id, die.name));
    }
    diceList.append(row);
    quantitySelections.set(die.id, 0);
  }
}

function createDiceAdvantageControls(dieId: string, dieName: string): HTMLElement {
  const controls = document.createElement("div");
  controls.className = "die-roll-options dice-advantage-options";
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", `${dieName} roll options`);

  for (const mode of ["advantage", "disadvantage"] as const) {
    const group = document.createElement("span");
    group.className = "dice-advantage-group";
    const label = document.createElement("span");
    label.className = "dice-advantage-label";
    label.textContent = mode === "advantage" ? "Adv" : "Dis";

    const minus = document.createElement("button");
    minus.className = "die-roll-option dice-advantage-step";
    minus.type = "button";
    minus.textContent = "−";
    minus.dataset.diceAdvantage = mode;
    minus.dataset.diceAdvantageAction = "decrement";
    minus.setAttribute("aria-label", `Remove one ${mode} ${dieName}`);
    minus.addEventListener("click", () => changeDiceAdvantage(dieId, mode, -1));

    const count = document.createElement("output");
    count.className = "dice-advantage-count";
    count.dataset.diceAdvantageCount = mode;
    count.textContent = "0";
    count.setAttribute("aria-label", `${dieName} ${mode} count`);

    const plus = document.createElement("button");
    plus.className = "die-roll-option dice-advantage-step";
    plus.type = "button";
    plus.textContent = "+";
    plus.dataset.diceAdvantage = mode;
    plus.dataset.diceAdvantageAction = "increment";
    plus.setAttribute("aria-label", `Add one ${mode} ${dieName}`);
    plus.addEventListener("click", () => changeDiceAdvantage(dieId, mode, 1));

    group.append(label, minus, count, plus);
    controls.append(group);
  }
  return controls;
}

function isAdvantageTarget(id: string): id is AdvantageTarget {
  return id === "d20" || id === "plot";
}

function changeDiceAdvantage(
  dieId: string,
  mode: AdvantageMode,
  amount: number,
): void {
  const selection = advantageSelections.dice?.[dieId];
  const currentCount = selection?.mode === mode ? selection.count : 0;
  const quantity = quantitySelections.get(dieId) ?? 0;
  const nextCount = Math.max(0, Math.min(quantity, currentCount + amount));
  advantageSelections = setDiceAdvantageSelection(
    advantageSelections,
    dieId,
    mode,
    nextCount,
  );
  updateAdvantageControls();
}

function setAdvantage(target: AdvantageTarget, mode: AdvantageMode): void {
  advantageSelections = toggleAdvantageSelection(
    advantageSelections,
    target,
    mode,
  );
  updateAdvantageControls();
}

function updateAdvantageControls(): void {
  for (const row of diceList.querySelectorAll<HTMLElement>("[data-die-id]")) {
    const target = row.dataset.dieId;
    if (!target) continue;
    if (isAdvantageTarget(target)) {
      for (const button of row.querySelectorAll<HTMLButtonElement>(
        "[data-advantage-mode]",
      )) {
        button.setAttribute(
          "aria-pressed",
          String(advantageSelections[target] === button.dataset.advantageMode),
        );
      }
    } else {
      const quantity = quantitySelections.get(target) ?? 0;
      const selection = advantageSelections.dice?.[target];
      for (const button of row.querySelectorAll<HTMLButtonElement>(
        "[data-dice-advantage]",
      )) {
        const mode = button.dataset.diceAdvantage;
        const count = selection && selection.mode === mode ? selection.count : 0;
        const increment = button.dataset.diceAdvantageAction === "increment";
        button.disabled = increment
          ? quantity === 0 || count >= quantity
          : count === 0;
        const output = button.parentElement?.querySelector<HTMLOutputElement>(
          `[data-dice-advantage-count="${mode}"]`,
        );
        if (output) output.textContent = String(count);
      }
    }
  }
}

function selectedAdvantageSettings(): AdvantageSettings {
  const selected: AdvantageSettings = {};
  for (const target of ["d20", "plot"] as const) {
    if (
      (quantitySelections.get(target) ?? 0) > 0 &&
      advantageSelections[target]
    ) {
      selected[target] = advantageSelections[target];
    }
  }
  for (const [dieId, selection] of Object.entries(
    advantageSelections.dice ?? {},
  )) {
    const count = Math.min(
      selection.count,
      quantitySelections.get(dieId) ?? 0,
    );
    if (count > 0) {
      selected.dice = {
        ...selected.dice,
        [dieId]: { mode: selection.mode, count },
      };
    }
  }
  return selected;
}

function selectedQuantities(): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const [id, quantity] of quantitySelections) {
    quantities[id] = quantity;
  }
  return quantities;
}

function updateRollButton(): void {
  const hasDice = [...quantitySelections.values()].some((quantity) => quantity > 0);
  const total = [...quantitySelections.values()].reduce(
    (sum, quantity) => sum + quantity,
    0,
  );
  rollButton.disabled = !roomReady || !hasDice;
  for (const row of diceList.querySelectorAll<HTMLElement>("[data-die-id]")) {
    const id = row.dataset.dieId;
    const count = id ? quantitySelections.get(id) ?? 0 : 0;
    const plus = row.querySelector<HTMLButtonElement>(".quantity-plus");
    if (plus) plus.disabled = count >= MAX_DICE_PER_TYPE || total >= MAX_DICE_PER_ROLL;
  }
  updateAdvantageControls();
  showError("");
}

function showError(message: string): void {
  errorMessage.textContent = message;
  errorMessage.hidden = message.length === 0;
}

function renderHistory(rolls: readonly SharedRoll[]): void {
  historyList.replaceChildren();
  resultsCount.textContent = rolls.length === 0 ? "" : `${rolls.length}`;

  if (rolls.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No rolls yet. Choose your dice and roll!";
    historyList.append(empty);
    return;
  }

  for (const roll of rolls) {
    const item = document.createElement("li");
    item.className = "roll-entry";

    const header = document.createElement("div");
    header.className = "roll-entry-header";
    const title = document.createElement("strong");
    const visibleDieCount = getVisibleDieCount(roll.results);
    title.textContent = `Roll · ${visibleDieCount} ${visibleDieCount === 1 ? "die" : "dice"}`;
    const time = document.createElement("time");
    time.dateTime = roll.timestamp;
    const parsedTime = new Date(roll.timestamp);
    time.textContent = Number.isNaN(parsedTime.getTime())
      ? "recently"
      : parsedTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    header.append(title, time);

    const resultGrid = document.createElement("div");
    resultGrid.className = "result-grid";
    const markedTargets = new Set<AdvantageTarget>();
    for (const result of roll.results) {
      const die = findDie(result.dieId);
      const face = die?.faces.find((candidate) => candidate.value === result.value);
      const target = isAdvantageTarget(result.dieId) ? result.dieId : undefined;
      const mode =
        target && !markedTargets.has(target) ? roll.advantage?.[target] : undefined;
      if (target && mode) markedTargets.add(target);
      const dieMode =
        mode ??
        (!target ? roll.advantage?.dice?.[result.dieId]?.mode : undefined);
      resultGrid.append(createFaceTile(die, face, result.value, dieMode));
      if (result.unselectedValue !== undefined) {
        const unselectedFace = die?.faces.find(
          (candidate) => candidate.value === result.unselectedValue,
        );
        resultGrid.append(
          createFaceTile(
            die,
            unselectedFace,
            result.unselectedValue,
            undefined,
            true,
          ),
        );
      }
      for (const unselectedValue of result.unselectedValues ?? []) {
        const unselectedFace = die?.faces.find(
          (candidate) => candidate.value === unselectedValue,
        );
        resultGrid.append(
          createFaceTile(
            die,
            unselectedFace,
            unselectedValue,
            undefined,
            true,
          ),
        );
      }
    }

    const footer = document.createElement("div");
    footer.className = "roll-total";
    footer.textContent = formatRollTotal(roll);
    const outcomes = getRollOutcomeCounts(roll.results);
    item.append(
      header,
      resultGrid,
      createRollOutcomeSummary(outcomes.opportunities, outcomes.complications),
      footer,
    );
    historyList.append(item);
  }
}

function formatRollTotal(roll: SharedRoll): string {
  const breakdown = getPlotweaverBreakdown(roll);
  if (
    roll.mode === "plotweaver" &&
    breakdown.hasD20 &&
    breakdown.hasOtherDice
  ) {
    return `Plotweaver · d20 + Plot + modifier: ${breakdown.d20AndPlot} | Hit (other dice + modifier): ${breakdown.hit} | Graze (other dice): ${breakdown.graze} | Total: ${breakdown.total}`;
  }
  if (roll.mode === "plotweaver" && breakdown.hasD20) {
    return `Plotweaver · d20 + Plot + modifier: ${breakdown.d20AndPlot} | Total: ${breakdown.total}`;
  }
  const modifierText = roll.modifier
    ? ` (dice ${sumNumericResults(roll.results) + getPlotDieBonus(roll.results)} ${roll.modifier > 0 ? "+" : "−"} ${Math.abs(roll.modifier)})`
    : "";
  return `Total: ${getRollTotal(roll)}${modifierText}`;
}

function createFaceTile(
  die: DieDefinition | undefined,
  face: DieFace | undefined,
  value: string,
  mode?: AdvantageMode,
  unselected = false,
): HTMLElement {
  const tile = document.createElement("div");
  tile.className = "face-tile";
  tile.classList.toggle("face-tile-unselected", unselected);
  tile.title = unselected
    ? `${die?.name ?? "Die"} (not selected): ${value}`
    : `${die?.name ?? "Die"}${mode ? ` (${mode}; kept ${mode === "advantage" ? "higher" : "lower"})` : ""}: ${value}`;
  tile.append(createDieGraphic(die, value, face));
  if (mode) {
    const marker = document.createElement("span");
    marker.className = "die-mode-marker";
    marker.textContent = mode === "advantage" ? "Adv" : "Dis";
    marker.setAttribute("aria-label", mode);
    tile.append(marker);
  }
  return tile;
}

function createDieGraphic(
  die: DieDefinition | undefined,
  value: string,
  face?: DieFace,
): HTMLElement {
  const graphic = document.createElement("span");
  graphic.className = "die-graphic";
  if (!die) {
    graphic.append(createDieResult("", value));
    return graphic;
  }

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

  if (value && !(die.id === "d6" && face?.art)) {
    const label = createDieResult(die.id, value);
    if (die.id === "plot" && value.startsWith("Complication")) {
      label.classList.add("die-result-complication");
    }
    graphic.append(label);
  }
  return graphic;
}

function setRolls(rolls: SharedRoll[]): void {
  visibleRolls = rolls.slice(0, HISTORY_LIMIT);
  renderHistory(visibleRolls);
}

function setModifier(value: number): void {
  modifier = value;
  modifierValueOutput.textContent = `${value > 0 ? "+" : ""}${value}`;
  modifierMinus.disabled = value <= -99;
  modifierPlus.disabled = value >= 99;
}

function clearRollSelection(): void {
  for (const [id] of quantitySelections) {
    quantitySelections.set(id, 0);
    const row = diceList.querySelector<HTMLElement>(`[data-die-id="${id}"]`);
    const count = row?.querySelector<HTMLOutputElement>(".quantity-value");
    if (count) count.textContent = "0";
  }
  setModifier(0);
  advantageSelections = {};
  updateAdvantageControls();
}

async function rollSelectedDice(): Promise<void> {
  showError("");
  rollButton.disabled = true;
  try {
    const selectedAdvantages = selectedAdvantageSettings();
    const results = rollDice(
      DICE_CATALOG,
      selectedQuantities(),
      Math.random,
      selectedAdvantages,
    );
    if (results.length === 0) return;

    const roll: SharedRoll = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      results,
      mode: rollMode,
      ...(modifierEnabled && modifier !== 0 ? { modifier } : {}),
      ...(Object.keys(selectedAdvantages).length > 0
        ? { advantage: selectedAdvantages }
        : {}),
    };

    if (previewMode) {
      setRolls([roll, ...visibleRolls]);
    } else {
      const metadata = await OBR.room.getMetadata();
      const existing = parseSharedRolls(metadata[METADATA_KEY]);
      await OBR.room.setMetadata({
        [METADATA_KEY]: [roll, ...existing].slice(0, HISTORY_LIMIT),
      });
      try {
        await OBR.broadcast.sendMessage(ROLL_BROADCAST_CHANNEL, roll, {
          destination: "ALL",
        });
      } catch (error) {
        throw new Error(
          `Roll saved to shared history, but its pop-up could not be sent: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    if (!keepSelection) clearRollSelection();
  } catch (error) {
    showError(error instanceof Error ? error.message : "The roll could not be shared.");
  } finally {
    updateRollButton();
  }
}

buildDiceControls();
renderHistory([]);
rollButton.addEventListener("click", () => void rollSelectedDice());
modifierToggle.addEventListener("click", () => {
  modifierEnabled = !modifierEnabled;
  modifierControls.hidden = !modifierEnabled;
  modifierToggle.setAttribute("aria-expanded", String(modifierEnabled));
  modifierToggle.textContent = modifierEnabled ? "Modifier" : "Add modifier";
});
modifierMinus.addEventListener("click", () => setModifier(modifier - 1));
modifierPlus.addEventListener("click", () => setModifier(modifier + 1));
saveRollButton.addEventListener("click", () => {
  keepSelection = !keepSelection;
  saveRollButton.setAttribute("aria-pressed", String(keepSelection));
  saveRollButton.textContent = keepSelection ? "Roll setup saved · keep after roll" : "Save roll setup";
});
plotweaverModeButton.addEventListener("click", () => setRollMode("plotweaver"));
regularModeButton.addEventListener("click", () => setRollMode("regular"));

function setRollMode(mode: "plotweaver" | "regular"): void {
  rollMode = mode;
  plotweaverModeButton.setAttribute("aria-pressed", String(mode === "plotweaver"));
  regularModeButton.setAttribute("aria-pressed", String(mode === "regular"));
}

if (previewMode) {
  statusLabel.textContent = "Local preview";
  roomReady = true;
  updateRollButton();
} else {
  OBR.onReady(() => {
    statusLabel.textContent = "Room connected";
    roomReady = true;
    updateRollButton();

    const syncRolls = (metadata: Record<string, unknown>) => {
      setRolls(parseSharedRolls(metadata[METADATA_KEY]));
      if (new URLSearchParams(window.location.search).has("history")) {
        historyList.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    void OBR.room.getMetadata().then(syncRolls).catch((error: unknown) => {
      showError(error instanceof Error ? error.message : "Could not load shared rolls.");
    });
    OBR.room.onMetadataChange(syncRolls);
  });
}
