import OBR from "@owlbear-rodeo/sdk";
import {
  DICE_CATALOG,
  findDie,
  MAX_DICE_PER_ROLL,
  MAX_DICE_PER_TYPE,
} from "./catalog";
import type { DieDefinition, DieFace } from "./catalog";
import {
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
const quantityInputs = new Map<string, HTMLInputElement>();

let roomReady = false;
let previewMode = new URLSearchParams(window.location.search).has("preview");
let visibleRolls: SharedRoll[] = [];

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Required page element "#${id}" was not found.`);
  }
  return element as T;
}

function buildDiceControls(): void {
  for (const die of DICE_CATALOG) {
    const row = document.createElement("label");
    row.className = "die-row";
    row.htmlFor = `quantity-${die.id}`;

    const title = document.createElement("span");
    title.className = "die-name";
    title.textContent = die.name;

    const description = document.createElement("span");
    description.className = "die-description";
    description.textContent = `${die.faces.length} faces`;

    const input = document.createElement("input");
    input.id = `quantity-${die.id}`;
    input.type = "number";
    input.min = "0";
    input.max = String(MAX_DICE_PER_TYPE);
    input.step = "1";
    input.value = "0";
    input.inputMode = "numeric";
    input.setAttribute("aria-label", `${die.name} quantity`);
    input.addEventListener("input", updateRollButton);

    row.append(title, description, input);
    diceList.append(row);
    quantityInputs.set(die.id, input);
  }
}

function selectedQuantities(): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const [id, input] of quantityInputs) {
    const quantity = Number(input.value);
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > MAX_DICE_PER_TYPE
    ) {
      throw new RangeError(`Choose a whole number from 0 to ${MAX_DICE_PER_TYPE} for ${id}.`);
    }
    quantities[id] = quantity;
  }
  const total = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
  if (total > MAX_DICE_PER_ROLL) {
    throw new RangeError(`Choose no more than ${MAX_DICE_PER_ROLL} dice per roll.`);
  }
  return quantities;
}

function updateRollButton(): void {
  try {
    const quantities = selectedQuantities();
    const hasDice = Object.values(quantities).some((quantity) => quantity > 0);
    rollButton.disabled = !roomReady || !hasDice;
    showError("");
  } catch (error) {
    rollButton.disabled = true;
    showError(error instanceof Error ? error.message : "Enter valid dice quantities.");
  }
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
    const total = sumNumericResults(roll.results);
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
    footer.textContent = `Total: ${total}`;
    item.append(header, resultGrid, footer);
    historyList.append(item);
  }
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
  } catch (error) {
    showError(error instanceof Error ? error.message : "The roll could not be shared.");
  } finally {
    updateRollButton();
  }
}

buildDiceControls();
renderHistory([]);
rollButton.addEventListener("click", () => void rollSelectedDice());

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
    };
    void OBR.room.getMetadata().then(syncRolls).catch((error: unknown) => {
      showError(error instanceof Error ? error.message : "Could not load shared rolls.");
    });
    OBR.room.onMetadataChange(syncRolls);
  });
}
