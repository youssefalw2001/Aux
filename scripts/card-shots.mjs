/**
 * Screenshots the share-card harness so the canvas output can actually be
 * reviewed. Canvas layout bugs are invisible to typechecking and to devtools,
 * so this is the only way to catch clipped text or broken composition.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "docs/preview";
const URL_ = process.env.HARNESS_URL ?? "http://localhost:3000/dev/card";

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 1400, height: 1200 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL_, { waitUntil: "networkidle" });
// Wait for document.fonts.ready to have flipped the harness flag
await page.waitForSelector('[data-ready="true"]', { timeout: 15000 });
// One extra frame so the final canvas paint has landed
await page.waitForTimeout(600);

const canvases = await page.locator("canvas").all();
if (canvases.length === 0) throw new Error("no canvases rendered");

for (let i = 0; i < canvases.length; i++) {
  await canvases[i].screenshot({ path: `${OUT}/share-card-${i + 1}.png` });
  console.log(`  wrote ${OUT}/share-card-${i + 1}.png`);
}

// Verify the canvas isn't blank — a black rect would pass a screenshot check
const nonBlank = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  if (!c) return false;
  const ctx = c.getContext("2d");
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4000) {
    seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
  }
  return seen.size;
});

console.log(`  distinct sampled colours: ${nonBlank}`);
if (typeof nonBlank === "number" && nonBlank < 4) {
  console.error("  ✗ canvas looks blank/flat");
  process.exitCode = 1;
}

if (errors.length) {
  console.error("  page errors:");
  errors.forEach((e) => console.error(`    ${e}`));
  process.exitCode = 1;
}

await browser.close();
console.log(errors.length ? "CARD SHOTS: errors" : "CARD SHOTS OK");
