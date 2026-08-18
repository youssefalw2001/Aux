/**
 * Loads the real routes in a browser and fails on console errors.
 *
 * Catches the class of bug that typechecking and SSR smoke tests both miss:
 * hydration mismatches, canvas exceptions, and client-only crashes. A
 * hydration warning is a real defect — React discards the server HTML and
 * re-renders, which shows up as a visible flash on a phone.
 */

import { chromium } from "playwright";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const ROUTES = ["/", "/demo", "/demo/bottle", "/r/PARTY", "/dev/card"];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const problems = [];

  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const t = m.text();
    // Hydration mismatches surface with these signatures
    if (
      /hydrat|did not match|server rendered|Text content does not match/i.test(t)
    ) {
      problems.push(`HYDRATION: ${t.slice(0, 180)}`);
    } else if (m.type() === "error") {
      problems.push(`ERROR: ${t.slice(0, 180)}`);
    }
  });
  page.on("pageerror", (e) => problems.push(`PAGEERROR: ${String(e).slice(0, 180)}`));

  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  if (problems.length === 0) {
    console.log(`  ✓ ${route}`);
  } else {
    console.log(`  ✗ ${route}`);
    problems.forEach((p) => console.log(`      ${p}`));
    failures += problems.length;
  }
  await page.close();
}

await browser.close();
console.log("");
console.log(failures === 0 ? "BROWSER CHECK OK" : `BROWSER CHECK: ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
