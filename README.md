# Shared Dice Roller for Owlbear Rodeo

A small Owlbear Rodeo extension for selecting quantities of common dice, rolling them, and sharing the latest room rolls. Rolls appear as Owlbear notifications for other players who have the extension installed, even while its dice popover is closed. The UI is plain TypeScript and CSS; roll history is stored in the room's namespaced metadata and live roll notifications are sent with Owlbear's broadcast API.

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
3. Once the workflow has been triggered, open the **Actions** tab and wait for **Deploy extension to GitHub Pages** to finish successfully. It installs dependencies, runs tests, builds the extension, writes absolute Pages URLs for the manifest icon and popover, and publishes the contents of `dist/`.
4. The extension manifest URL is `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/manifest.json`, with your GitHub username and repository name in place of the placeholders.
5. In Owlbear Rodeo, use the extension menu's option to add/load an extension by URL and paste that manifest URL. Each player who should receive roll pop-ups must load the same extension URL in that room; they do not need to open the dice popover.

On later pushes to `main`, GitHub Actions automatically tests, rebuilds, and republishes the extension. The source repository and published Pages files are public. The manifest in `public/` uses relative paths for the source project; the deployment workflow replaces those with absolute URLs for the Pages site, including its background listener page. You can also test locally with `npm run build` and `npm run preview`, but Owlbear will still need the published HTTPS URL rather than your local preview URL.

Room history is kept to the newest 12 rolls in metadata under `com.dieroller.shared-dice-roller/rolls`. It is a small room-data feed, not an archive or a private roll channel. Each roll is limited to 20 dice to keep the shared data small.

## Add a custom die

Dice are declared in `src/catalog.ts` in the `DICE_CATALOG` array. Each `DieDefinition` has a unique `id`, a display `name`, and an ordered `faces` array. A face's `value` is the displayed result and its optional `art` is a URL relative to the site root.

For a symbol die, add an entry like this (and add it to `DICE_CATALOG`):

```ts
{
  id: "fate",
  name: "Fate",
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

Roll selection, per-die quantity controls, face selection, and result display are generated from the catalog. Use unique die IDs and string face values; all faces are equally likely. Each quantity field allows up to 20, with a maximum of 20 dice combined in a single roll. The displayed total sums numeric result values, so symbol-based dice display their result faces but do not contribute a numeric total.

## Add 2D face artwork

1. Put one image file per face under `public/art/dice/<die-id>/`, for example `public/art/dice/fate/minus.svg` and `public/art/dice/fate/plus.svg`. SVG and raster image formats supported by browsers work.
2. Set the corresponding face's `art` to its deployed URL, such as `./art/dice/fate/minus.svg`. Keep `value` as the text result shown on the face tile.
3. For a numeric die with numbered faces, follow the existing d6 mapping in `src/catalog.ts` and add image files at `public/art/dice/<die-id>/<value>.svg`.
4. Run `npm run build` and make sure the referenced files are present in `dist/art/` before deployment.

The d6 is a complete example: its six simple placeholder pip illustrations live in `public/art/dice/d6/` and are wired by face value in the catalog.
