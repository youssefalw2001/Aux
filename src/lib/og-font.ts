/**
 * Font loading for ImageResponse.
 *
 * The unfurl card is the single most-seen surface in the product — it renders
 * inside Instagram DMs and is the entire top of funnel — so it gets the brand
 * typeface rather than the runtime default.
 *
 * Wrapped in a failure path: if Google's CDN is slow or blocked, we return
 * null and the card renders in the fallback font. A slightly off-brand card
 * beats a broken preview, because a failed OG fetch means the link unfurls as
 * a bare URL and conversion collapses.
 */

const CACHE = new Map<string, ArrayBuffer | null>();

export async function loadBricolage(
  weight: 800 | 700 = 800,
): Promise<ArrayBuffer | null> {
  const key = `bricolage-${weight}`;
  if (CACHE.has(key)) return CACHE.get(key) ?? null;

  try {
    // Resolve the CSS to find the actual TTF/WOFF URL for this weight
    const cssRes = await fetch(
      `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,${weight}&display=swap`,
      {
        headers: {
          // Without a modern UA, Google returns woff2 which Satori can't parse
          "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0)",
        },
      },
    );
    if (!cssRes.ok) throw new Error(`css ${cssRes.status}`);

    const css = await cssRes.text();
    const url = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1];
    if (!url) throw new Error("no font url in css");

    const fontRes = await fetch(url);
    if (!fontRes.ok) throw new Error(`font ${fontRes.status}`);

    const buf = await fontRes.arrayBuffer();
    CACHE.set(key, buf);
    return buf;
  } catch {
    CACHE.set(key, null);
    return null;
  }
}
