import OBR from "@owlbear-rodeo/sdk";
import {
  DICE_CATALOG,
  findDie,
  MAX_DICE_PER_ROLL,
  MAX_DICE_PER_TYPE,
} from "./catalog";
import type { DieDefinition, DieFace } from "./catalog";
import {
  getPlotDieBonus,
  getRollTotal,
  getPlotweaverBreakdown,
  parseSharedRolls,
  rollDice,
  ROLL_BROADCAST_CHANNEL,
  sumNumericResults,
} from "./rolls";
import type { SharedRoll } from "./rolls";
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
const quantitySelections = new Map<string, number>();

let roomReady = false;
let previewMode = new URLSearchParams(window.location.search).has("preview");
let visibleRolls: SharedRoll[] = [];
let modifier = 0;
let modifierEnabled = false;
let rollMode: "plotweaver" | "regular" = "plotweaver";

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

    const title = document.createElement("span");
    title.className = "die-name";
    title.textContent = die.name;

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
      count.textContent = String(quantitySelections.get(die.id));
      updateRollButton();
    };
    minus.addEventListener("click", () => changeQuantity(-1));
    plus.addEventListener("click", () => changeQuantity(1));

    quantityControls.append(minus, count, plus);
    row.append(title, description, quantityControls);
    diceList.append(row);
    quantitySelections.set(die.id, 0);
  }
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
    title.textContent = `Roll · ${roll.results.length} ${roll.results.length === 1 ? "die" : "dice"}`;
    const time = document.createElement("time");
    time.dateTime = roll.timestamp;
    const parsedTime = new Date(roll.timestamp);
    time.textContent = Number.isNaN(parsedTime.getTime())
      ? "recently"
      : parsedTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    header.append(title, time);

    const resultGrid = document.createElement("div");
    resultGrid.className = "result-grid";
    for (const result of roll.results) {
      const die = findDie(result.dieId);
      const face = die?.faces.find((candidate) => candidate.value === result.value);
      resultGrid.append(createFaceTile(die, face, result.value));
    }

    const footer = document.createElement("div");
    footer.className = "roll-total";
    footer.textContent = formatRollTotal(roll);
    item.append(header, resultGrid, footer);
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
    return `Plotweaver · d20 + Plot + modifier: ${breakdown.d20AndPlot} | Other dice: ${breakdown.otherDice} | Total: ${breakdown.total}`;
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
): HTMLElement {
  const tile = document.createElement("div");
  tile.className = "face-tile";
  tile.title = `${die?.name ?? "Die"}: ${value}`;
  if (face?.art) {
    const image = document.createElement("img");
    image.src = face.art;
    image.alt = `${die?.name ?? "Die"} face ${value}`;
    image.loading = "lazy";
    image.addEventListener("error", () => image.remove());
    tile.append(image);
  }
  const label = document.createElement("span");
  label.textContent = value;
  tile.append(label);
  return tile;
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

function clearSelectedDice(): void {
  for (const [id] of quantitySelections) {
    quantitySelections.set(id, 0);
    const row = diceList.querySelector<HTMLElement>(`[data-die-id="${id}"]`);
    const count = row?.querySelector<HTMLOutputElement>(".quantity-value");
    if (count) count.textContent = "0";
  }
}

async function rollSelectedDice(): Promise<void> {
  showError("");
  rollButton.disabled = true;
  try {
    const results = rollDice(DICE_CATALOG, selectedQuantities());
    if (results.length === 0) return;

    const roll: SharedRoll = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      results,
      mode: rollMode,
      ...(modifierEnabled && modifier !== 0 ? { modifier } : {}),
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
    clearSelectedDice();
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
