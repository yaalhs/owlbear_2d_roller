export function createDieResult(dieId: string, value: string): HTMLSpanElement {
  const result = document.createElement("span");
  result.className = "die-result";

  if (dieId !== "plot") {
    result.textContent = value;
    return result;
  }

  if (value === "Opportunity") {
    appendPlotGlyph(result, "O");
    return result;
  }

  if (value === "Blank") {
    result.textContent = "—";
    return result;
  }

  const complication = /^Complication \+([24])$/.exec(value);
  if (!complication) {
    result.textContent = value;
    return result;
  }

  appendPlotGlyph(result, "C");
  const modifier = document.createElement("span");
  modifier.textContent = ` +${complication[1]}`;
  result.append(modifier);
  return result;
}

function appendPlotGlyph(result: HTMLSpanElement, glyph: "C" | "O"): void {
  const glyphElement = document.createElement("span");
  glyphElement.className = "plot-dingbat";
  glyphElement.textContent = glyph;
  result.append(glyphElement);
}

export function createRollOutcomeSummary(
  opportunities: number,
  complications: number,
): HTMLDivElement {
  const summary = document.createElement("div");
  summary.className = "roll-outcome-summary";
  appendOutcomeCount(summary, "O", opportunities, "opportunities");
  appendOutcomeCount(summary, "C", complications, "complications");
  return summary;
}

function appendOutcomeCount(
  summary: HTMLDivElement,
  glyph: "C" | "O",
  count: number,
  label: string,
): void {
  const item = document.createElement("span");
  item.className = "roll-outcome-count";
  const icon = document.createElement("span");
  icon.className = "plot-dingbat";
  icon.textContent = glyph;
  const value = document.createElement("span");
  value.textContent = String(count);
  item.setAttribute("aria-label", `${count} ${label}`);
  item.append(icon, value);
  summary.append(item);
}
