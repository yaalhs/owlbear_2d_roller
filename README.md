# Shared Dice Roller for Owlbear Rodeo

A small Owlbear Rodeo extension for selecting dice with plus/minus buttons, rolling them, and sharing results. Rolls appear in a temporary bottom-right pop-up for other players who have the extension installed, even while its dice tray is closed. Click a roll pop-up to open the shared roll history. The custom pop-up stays visible for six seconds. Roll history is stored in the room's namespaced metadata and live roll events are sent with Owlbear's broadcast API.

> **Blatantly vibecoded.** Expect rough edges; review and test before relying on it.

## Requirements

- Node.js 20 or newer and npm
- An Owlbear Rodeo room to try the shared extension

## Local setup and preview

From this project folder:

```sh
npm install
npm run dev
```

Open the Vite URL printed in the terminal and add `?preview` (for example, `http://localhost:5173/?preview`). Preview mode lets you try the dice UI locally without Owlbear Rodeo; its results are local to that page and are not room-synced.

## Test and production build

```sh
npm test
npm run build
npm run preview
```

`npm run build` type-checks the TypeScript and writes the deployable site to `dist/`. `npm run preview` serves that built site locally.

## Publish from GitHub and load in Owlbear Rodeo

Owlbear does not run the source code directly from your computer or a GitHub repository page. It loads the extension from public HTTPS-hosted files. GitHub Pages can host those files, so your computer does not need to stay on after the Pages deployment is complete.

1. Place the project in a **public GitHub repository**, including the `.github/workflows/deploy.yml` workflow.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Once the workflow has been triggered, open the **Actions** tab and wait for **Deploy extension to GitHub Pages** to finish successfully. It installs dependencies, runs tests, builds the extension, writes absolute Pages URLs for the manifest icon, popover, and background page, and publishes the contents of `dist/`.
4. The extension manifest URL is `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/manifest.json`, with your GitHub username and repository name in place of the placeholders.
5. In Owlbear Rodeo, use the extension menu's option to add/load an extension by URL and paste that manifest URL. Each player who should receive roll pop-ups must load the same extension URL in that room; they do not need to open the dice popover.

On later pushes to `main`, GitHub Actions automatically tests, rebuilds, and republishes the extension. The source repository and published Pages files are public. The manifest in `public/` uses relative paths for the source project; the deployment workflow replaces those with absolute URLs for the Pages site, including its background listener page. After updating an installed extension, reload/remove and re-add it in Owlbear so its manifest and background page are refreshed. You can also test locally with `npm run build` and `npm run preview`, but Owlbear will still need the published HTTPS URL rather than your local preview URL.

Room history is kept to the newest 12 rolls in metadata under `com.dieroller.shared-dice-roller/rolls`. It is a small room-data feed, not an archive or a private roll channel. Each roll is limited to 20 dice to keep the shared data small. By default, selected dice and the modifier reset after a successful roll; toggle **Save roll setup** to retain both for the next roll. The pop-up shows the roll count as its heading and the die results on a wrapping subtitle. Plot die Complication +2/+4 faces add 2/4 to the result; Opportunity and Blank add zero.

## Dice controls

Use the `+` and `−` buttons beside each die to build a roll; each type and the whole roll are capped at 20 selected dice. For d4, d6, d8, d10, and d12, the **Adv** and **Dis** steppers set how many dice get Advantage or Disadvantage. Each point applies to one selected die: roll the selected quantity plus the Advantage/Disadvantage count, then keep the highest/lowest selected number of results. Custom symbol dice compare in the face order declared in `src/catalog.ts`. The chosen results appear at full opacity and discarded candidates are dimmed. The d20 and Plot die keep their single-use Advantage/Disadvantage controls. All dice in one roll must use the same mode; choosing the opposite mode clears the previous mode selections. Select **Add modifier** to show its `+`/`−` stepper. The **Save roll setup** button keeps the selected dice and modifier after each successful roll while enabled. The pop-up lays out results in rows and uses compact dice for large rolls, up to three rows. The final result summary counts kept Plot Opportunity and Complication faces, plus natural 20s and 1s on the d20 as an Opportunity or Complication; discarded Advantage/Disadvantage faces do not count. It presents both counts using the bundled Cosmere Dingbats O and C glyphs. Plot outcomes are ordered Opportunity, Blank, Complication +4, Complication +2 for advantage/disadvantage comparisons; its standard face probabilities remain two Opportunity, two Blank, one +4, and one +2. Plot `O` and `C` glyphs use the bundled Cosmere Dingbats font; plus signs and complication values use the regular UI font. The picker displays each die's maximum face on the silhouette; for the d6 this is the numeral 6, and for the Plot die the marker is Opportunity. The Plot die's face values and order are in `src/catalog.ts`, in `DICE_CATALOG`.

Choose **Plotweaver** mode to show **d20 + Plot + modifier**, **Hit** (the other numeric dice plus the modifier), and **Graze** (the other numeric dice without the modifier). The modifier is added to both d20 + Plot and Hit when both components are present. If no other numeric dice are rolled, only d20 + Plot + modifier is shown. Plotweaver results do not show a separate combined Total. Choose **Regular** mode to show one total for all numeric dice, the modifier, and Plot complication bonuses. The result mode is saved with each shared roll, so the pop-up and history use the mode selected by the roller.

## Add a custom die

Dice are declared in `src/catalog.ts` in the `DICE_CATALOG` array. Each `DieDefinition` has a unique `id`, a display `name`, a `shape`, and an ordered `faces` array. A face's `value` is the displayed result and its optional `art` is a URL relative to the site root. Each shape has its own SVG in `src/die-shapes/`, using the supplied white polyhedral silhouettes. Result labels are centered over the die, and the regular d6 shows pip artwork without an extra numeral.

For a symbol die, add an entry like this (and add it to `DICE_CATALOG`):

```ts
{
  id: "fate",
  name: "Fate",
  shape: "cube",
  faces: [
    { value: "−" },
    { value: "−" },
    { value: "blank" },
    { value: "blank" },
    { value: "+" },
    { value: "+" },
  ],
}
```

Roll selection, per-die quantity controls, face selection, and result display are generated from the catalog. Use unique die IDs and string face values; each face is equally likely. The `+` and `−` controls add or remove dice, with a maximum of 20 of each type and 20 total dice per roll. The optional signed modifier and Plot die complication bonus are included in the total.

To add a custom shape, add its name to the `DieShape` type and add a matching SVG path in the `DIE_SHAPE_ART` map in `src/catalog.ts`. Create `src/die-shapes/<shape>.svg` with the silhouette and internal face edges, then use that shape on the die's `shape` property. The camera-facing result-label positions and face-art clipping are in `src/die-graphic.css`.

## Add 2D face artwork

1. Put one image file per face under `public/art/dice/<die-id>/`, for example `public/art/dice/fate/minus.svg` and `public/art/dice/fate/plus.svg`. SVG and raster image formats supported by browsers work.
2. Set the corresponding face's `art` to its deployed URL, such as `./art/dice/fate/minus.svg`. Keep `value` as the text result shown on the face tile.
3. For a numeric die with numbered faces, follow the existing d6 mapping in `src/catalog.ts` and add image files at `public/art/dice/<die-id>/<value>.svg`.
4. Run `npm run build` and make sure the referenced files are present in `dist/art/` before deployment.

The d6 is a complete example: its six simple placeholder pip illustrations live in `public/art/dice/d6/` and are wired by face value in the catalog.
