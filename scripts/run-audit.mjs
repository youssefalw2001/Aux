/**
 * Bundles and runs the daily-rotation audit.
 *
 * The audit imports the real TypeScript sources so it can't drift from the
 * implementation, but Node's ESM loader won't resolve extensionless TS imports.
 * esbuild (already present via wrangler) bundles it in one pass.
 */
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(tmpdir(), `daily-audit-${Date.now()}.mjs`);

await build({
  entryPoints: ["scripts/daily-audit.mjs"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: out,
  logLevel: "error",
});

await import(pathToFileURL(out).href);
