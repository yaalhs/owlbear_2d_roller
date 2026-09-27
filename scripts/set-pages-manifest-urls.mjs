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
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

manifest.icon = new URL("icon.svg", siteUrl).href;
manifest.action.icon = new URL("icon.svg", siteUrl).href;
manifest.action.popover = new URL("index.html", siteUrl).href;

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
