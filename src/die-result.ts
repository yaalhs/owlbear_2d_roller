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
