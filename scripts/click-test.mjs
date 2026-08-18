/**
 * Clicks every internal navigation button and asserts the URL actually changes.
 *
 * This exists because two separate bugs produced buttons that animated on tap
 * and then did nothing, both completely silent — no console error, no network
 * request, nothing to grep. The only way to catch that class of defect is to
 * click the thing and check where you end up.
 *
 * Runs against the STATIC EXPORT served under the basePath, because that's the
 * deployed environment and it's the one where client-side routing breaks.
 */
import { chromium } from "playwright";

const BASE = process.env.APP_URL ?? "http://localhost:8090/Aux";

const CASES = [
  { from: "/", label: "Spin the Bottle", want: "/demo/bottle" },
  { from: "/", label: "Voice Roulette", want: "/demo/" },
  { from: "/", label: "Top takes", want: "/today" },
  { from: "/", label: "See a room invite", want: "/r/PARTY" },
  { from: "/today/", label: "Record today", want: "/demo" },
  { from: "/demo/bottle/", label: "aux", want: "/Aux/" },
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;

for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));

  try {
    await page.goto(`${BASE}${c.from}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);

    // Resolve the anchor directly, then click its centre. Using getByText can
    // resolve to an ancestor and click empty space.
    const rect = await page.evaluate((label) => {
      const a = [...document.querySelectorAll("a")].find((x) =>
        (x.textContent ?? "").includes(label),
      );
      if (!a) return null;
      a.scrollIntoView({ block: "center" });
      const r = a.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: a.getAttribute("href") };
    }, c.label);

    if (!rect) {
      console.log(`  ✗ "${c.label}" on ${c.from} — anchor not found`);
      failures++;
      await page.close();
      continue;
    }

    await page.mouse.click(rect.x, rect.y);
    await page.waitForTimeout(1600);

    const url = page.url();
    const ok = url.includes(c.want);
    const shown = url.replace(BASE, "") || "/";
    console.log(
      `  ${ok ? "✓" : "✗"} ${c.from} · "${c.label}" → ${shown}${ok ? "" : `  (want ${c.want})`}`,
    );
    if (!ok) failures++;
    if (errs.length) errs.forEach((e) => console.log(`      [pageerror] ${e}`));
  } catch (e) {
    console.log(`  ✗ "${c.label}" — ${String(e).slice(0, 90)}`);
    failures++;
  }
  await page.close();
}

await browser.close();
console.log("");
console.log(failures === 0 ? "CLICK TEST OK" : `CLICK TEST: ${failures} broken`);
process.exit(failures === 0 ? 0 : 1);
