/**
 * Screenshots key screens, driving the UI the way a player would.
 *
 * The bottle circle is positioned with trigonometry and the bottle itself is
 * inline SVG rotated by an animation — neither is verifiable by typechecking,
 * and both break silently (avatars stacked at the centre, bottle pointing at
 * nothing). This walks the real flow and captures each beat.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const OUT = "docs/preview";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 420, height: 920 },
  deviceScaleFactor: 2,
});

const problems = [];
page.on("pageerror", (e) => problems.push(String(e).slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") problems.push(m.text().slice(0, 160));
});

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  wrote ${OUT}/${name}.png`);
};

/* ---------- landing ---------- */
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1400);
await shot("screen-landing");

/* ---------- spin the bottle ---------- */
await page.goto(`${BASE}/demo/bottle`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await shot("screen-bottle-join");

await page.getByPlaceholder("Your name").fill("Sam");
await page.getByRole("button", { name: /join the circle/i }).click();
await page.waitForTimeout(900);
await shot("screen-bottle-lobby");

await page.getByRole("button", { name: /spin the bottle/i }).click();
// Mid-spin: bottle should be rotated and avatars laid out in a ring
await page.waitForTimeout(1200);
await shot("screen-bottle-spinning");

/* ---------- geometry assertions ----------
   Must run DURING the spin. Once the bottle lands, the component unmounts into
   the recording phase and every selector here goes null — which reads as a
   component failure rather than a test-timing mistake. */
const geometry = await page.evaluate(() => {
  const circles = [...document.querySelectorAll("div")].filter((d) =>
    /^[A-Z]$/.test((d.textContent ?? "").trim()),
  );
  const boxes = circles.map((c) => {
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  const uniq = new Set(boxes.map((b) => `${b.x},${b.y}`));
  const svg = document.querySelector("svg[viewBox='0 0 34 132']");
  const rotated = svg?.parentElement
    ? getComputedStyle(svg.parentElement).transform
    : "none";
  return { avatars: boxes.length, distinctPositions: uniq.size, rotated };
});

console.log(`  avatars found: ${geometry.avatars}`);
console.log(`  distinct positions: ${geometry.distinctPositions}`);
console.log(`  bottle transform: ${geometry.rotated.slice(0, 60)}`);

if (geometry.distinctPositions < 4) {
  problems.push(
    `avatars not distributed — only ${geometry.distinctPositions} distinct positions`,
  );
}
if (!geometry.rotated || geometry.rotated === "none") {
  problems.push("bottle has no transform — spin did not apply");
}

// Let the spin settle, then confirm the prompt actually arrived
await page.waitForTimeout(4600);
await shot("screen-bottle-landed");

const landed = await page.evaluate(() => document.body.innerText);
if (!/round|it landed on you|tap to record|hold to record/i.test(landed)) {
  problems.push("no prompt/record stage after the spin settled");
}

await browser.close();

if (problems.length) {
  console.error("\nproblems:");
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log("\nPAGE SHOTS OK");
