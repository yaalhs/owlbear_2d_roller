import {
  getModifierDiceValue,
  getFitdOutcome,
  getPlotDieBonus,
  getPlotweaverBreakdown,
  getRollTotal,
  sumNumericResults,
} from "./rolls";
import type { SharedRoll } from "./rolls";

export function appendRollSummary(
  target: HTMLElement,
  roll: SharedRoll,
  options: { readonly showPlotweaverLabel?: boolean; readonly totalColon?: boolean } = {},
): void {
  if (roll.mode === "fitd") {
    const outcome = getFitdOutcome(roll.results[0]?.dieId ?? "", roll.results);
    if (outcome) {
      target.append(document.createTextNode("Forged in the Dark · "));
      appendCalculatedValue(
        target,
        `${outcome.name} · ${outcome.highestValue}`,
      );
    }
    return;
  }

  const breakdown =
    roll.mode === "plotweaver" ? getPlotweaverBreakdown(roll) : undefined;
  if (breakdown?.hasD20) {
    if (options.showPlotweaverLabel) {
      target.append(document.createTextNode("Plotweaver · "));
    }
    target.append(document.createTextNode("d20 + Plot + modifier "));
    appendCalculatedValue(target, breakdown.d20AndPlot);
    if (breakdown.hasOtherDice) {
      target.append(document.createTextNode(" · Hit "));
      appendCalculatedValue(target, breakdown.hit);
      target.append(document.createTextNode(" · Graze "));
      appendCalculatedValue(target, breakdown.graze);
    }
    return;
  }

  target.append(document.createTextNode(options.totalColon ? "Total: " : "Total "));
  appendCalculatedValue(target, getRollTotal(roll));
  if (roll.modifier) {
    const diceSubtotal =
      sumNumericResults(roll.results) +
      getPlotDieBonus(roll.results) +
      getModifierDiceValue(roll.modifierDice);
    target.append(
      document.createTextNode(
        ` (dice ${diceSubtotal} ${roll.modifier > 0 ? "+" : "−"} ${Math.abs(roll.modifier)})`,
      ),
    );
  }
}

function appendCalculatedValue(target: HTMLElement, value: number | string): void {
  const result = document.createElement("span");
  result.className = "calculated-result";
  result.textContent = String(value);
  target.append(result);
}
