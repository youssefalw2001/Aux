/**
 * Post-processing for the static export target (GitHub Pages).
 *
 * Two fixes:
 *
 * 1. `.nojekyll` — GitHub Pages runs Jekyll by default, which silently skips
 *    directories beginning with an underscore. Without this file, all of
 *    `_next/` is dropped and the site loads with zero CSS or JS.
 *
 * 2. Extensionless OG images — Next exports `opengraph-image` with no file
 *    extension. Static hosts serve that as application/octet-stream, so
 *    crawlers reject it. We copy each one to a `.png` sibling so it's at least
 *    directly viewable. (Real unfurls still need the server target: the whole
 *    point of that card is being generated per room code on demand.)
 */

import { cp, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "out";

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(path)));
    else found.push(path);
  }
  return found;
}

try {
  await stat(OUT);
} catch {
  console.error(`postexport: ${OUT}/ not found — run the export build first.`);
  process.exit(1);
}

await writeFile(join(OUT, ".nojekyll"), "");
console.log("postexport: wrote .nojekyll");

const files = await walk(OUT);
const ogFiles = files.filter((f) => /opengraph-image$/.test(f));

for (const f of ogFiles) {
  await cp(f, `${f}.png`);
  console.log(`postexport: ${f} → ${f}.png`);
}

console.log(
  `postexport: done (${ogFiles.length} OG image${ogFiles.length === 1 ? "" : "s"} duplicated)`,
);
