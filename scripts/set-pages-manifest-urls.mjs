import { readFile, writeFile } from "node:fs/promises";

const repository = process.env.GITHUB_REPOSITORY;
if (!repository) {
  throw new Error("GITHUB_REPOSITORY must be set to owner/repository.");
}

const [owner, name, ...extra] = repository.split("/");
if (!owner || !name || extra.length > 0) {
  throw new Error(`Invalid GitHub repository name: ${repository}`);
}

const siteUrl = new URL(`${encodeURIComponent(name)}/`, `https://${owner}.github.io/`);
const manifestPath = new URL("../dist/manifest.json", import.meta.url);
const actionIconPath = new URL("../dist/action-icon.svg", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const actionIcon = await readFile(actionIconPath, "utf8");

if (!manifest.action || typeof manifest.action !== "object") {
  throw new Error("The extension manifest must keep its action configuration.");
}

manifest.icon = new URL("icon.svg", siteUrl).href;
manifest.action.icon = new URL("action-icon.svg", siteUrl).href;
manifest.action.popover = new URL("index.html", siteUrl).href;
manifest.background_url = new URL("background.html", siteUrl).href;

if (
  !/<svg\b[^>]*\bwidth="24px"[^>]*\bheight="24px"[^>]*\bviewBox="0 0 24 24"/s.test(
    actionIcon,
  ) ||
  /\bhref\s*=|url\s*\(/i.test(actionIcon)
) {
  throw new Error(
    "dist/action-icon.svg must be a self-contained 24px SVG with a 0 0 24 24 viewBox.",
  );
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const deployedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
const expectedActionIcon = new URL("action-icon.svg", siteUrl).href;
if (deployedManifest.action?.icon !== expectedActionIcon) {
  throw new Error(
    `Built action icon URL must be ${expectedActionIcon}.`,
  );
}
