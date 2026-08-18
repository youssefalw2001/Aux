/**
 * Haptics.
 *
 * IMPORTANT: Apple does not implement the Vibration API in Safari on iOS or
 * iPadOS. `navigator.vibrate` is Android-only, full stop. There is no web API
 * that changes this — a proper Web Haptics API is still a WICG proposal.
 *
 * The one iOS workaround is a quirk: toggling a `<input type="checkbox" switch>`
 * inside a `<label>` fires the system's native switch haptic on iOS 17.4+.
 * It's unofficial and Apple may remove it at any time.
 *
 * Therefore: haptics in this app are ALWAYS enhancement, never load-bearing.
 * No interaction may depend on haptic confirmation to be understood.
 */

type Pattern = "tick" | "tap" | "thud" | "success" | "error" | "warn";

const PATTERNS: Record<Pattern, number | number[]> = {
  tick: 8,
  tap: 14,
  thud: 32,
  success: [16, 60, 28],
  error: [40, 55, 40, 55, 40],
  warn: [22, 70, 22],
};

let iosSwitch: HTMLLabelElement | null = null;
let enabled = true;

/**
 * Builds the offscreen label+switch used for the iOS haptic quirk.
 * Created lazily so SSR and non-iOS devices never pay for it.
 */
function getIosSwitch(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (iosSwitch) return iosSwitch;

  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText =
    "position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;pointer-events:none;";

  const input = document.createElement("input");
  input.type = "checkbox";
  // `switch` is the attribute that unlocks the native haptic on iOS 17.4+
  input.setAttribute("switch", "");
  input.style.cssText = "appearance:none;width:1px;height:1px;";

  label.appendChild(input);
  document.body.appendChild(label);
  iosSwitch = label;
  return label;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac, so check for touch
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Fire a haptic. Silently no-ops where unsupported — by design. */
export function haptic(pattern: Pattern = "tap") {
  if (!enabled || typeof window === "undefined") return;

  // Respect reduced-motion as a proxy for "reduce sensory output"
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(PATTERNS[pattern]);
      return;
    } catch {
      /* fall through */
    }
  }

  if (isIos()) {
    try {
      getIosSwitch()?.click();
    } catch {
      /* unsupported — acceptable */
    }
  }
}

export function setHapticsEnabled(next: boolean) {
  enabled = next;
}

export function hapticsEnabled() {
  return enabled;
}
