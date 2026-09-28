import { findDie } from "./catalog";
import { parseSharedRolls, sumNumericResults } from "./rolls";
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
  const heading = document.createElement("strong");
  heading.className = "toast-heading";
  heading.textContent = `Dice rolled · ${roll.results.length} ${
    roll.results.length === 1 ? "die" : "dice"
  }`;

  const faces = document.createElement("div");
  faces.className = "toast-faces";
  for (const result of roll.results) {
    const die = findDie(result.dieId);
    const face = die?.faces.find((candidate) => candidate.value === result.value);
    const tile = document.createElement("span");
    tile.className = "toast-face";
    tile.title = `${die?.name ?? result.dieId}: ${result.value}`;

    if (face?.art) {
      const image = document.createElement("img");
      image.src = face.art;
      image.alt = "";
      image.addEventListener("error", () => image.remove());
      tile.append(image);
    }

    const value = document.createElement("span");
    value.textContent = result.value;
    tile.append(value);
    faces.append(tile);
  }

  const total = document.createElement("span");
  total.className = "toast-total";
  total.textContent = `Total ${sumNumericResults(roll.results)}`;
  root.append(heading, faces, total);
}
