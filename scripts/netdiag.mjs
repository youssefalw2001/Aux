/**
 * Captures every network request and console message from page load through a
 * button click, so we find out what's actually failing instead of guessing.
 */
import { chromium } from "playwright";

const BASE = process.env.APP_URL ?? "https://youssefalw2001.github.io/Aux";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

const net = [];
page.on("response", (r) => net.push({ status: r.status(), url: r.url() }));
page.on("requestfailed", (r) =>
  net.push({ status: "FAIL", url: r.url(), err: r.failure()?.errorText }),
);
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${String(e).slice(0, 300)}`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

console.log(`base: ${BASE}`);
console.log("--- non-200 responses during LOAD (incl. prefetch) ---");
const bad = net.filter((n) => n.status !== 200 && n.status !== 304);
if (bad.length === 0) console.log("  (none)");
bad.slice(0, 20).forEach((n) =>
  console.log(`  ${n.status} ${n.url.replace(BASE, "")}${n.err ? " " + n.err : ""}`),
);

console.log("--- .txt / RSC payload requests during LOAD ---");
const rsc = net.filter((n) => /\.txt|_rsc|__next/.test(n.url));
if (rsc.length === 0) console.log("  (none — no prefetch happened)");
rsc.slice(0, 12).forEach((n) => console.log(`  ${n.status} ${n.url.replace(BASE, "")}`));

// Instrument the anchor: does it get the click, and is default prevented?
await page.evaluate(() => {
  const a = [...document.querySelectorAll("a")].find((x) =>
    (x.textContent ?? "").includes("Spin the Bottle"),
  );
  window.__d = { found: !!a, href: a?.getAttribute("href") };
  a?.addEventListener("click", (e) => {
    window.__d.clicked = true;
    window.__d.prevented = e.defaultPrevented;
    setTimeout(() => {
      window.__d.preventedAfter = e.defaultPrevented;
    }, 0);
  });
});

net.length = 0;
logs.length = 0;

const rect = await page.evaluate(() => {
  const a = [...document.querySelectorAll("a")].find((x) =>
    (x.textContent ?? "").includes("Spin the Bottle"),
  );
  const r = a.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.click(rect.x, rect.y);
await page.waitForTimeout(2500);

console.log("--- click result ---");
console.log("  ", JSON.stringify(await page.evaluate(() => window.__d)));
console.log("  url after click:", page.url());
console.log("--- network during click ---");
if (net.length === 0) console.log("  (no requests)");
net.slice(0, 20).forEach((n) => console.log(`  ${n.status} ${n.url.replace(BASE, "")}`));
console.log("--- console during click ---");
if (logs.length === 0) console.log("  (silent)");
logs.slice(0, 15).forEach((l) => console.log("  " + l));

await browser.close();
