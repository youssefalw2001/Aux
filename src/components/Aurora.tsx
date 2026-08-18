import { cn } from "@/lib/utils";

/**
 * Ambient backdrop.
 *
 * Three slowly drifting blurred blooms behind the content. It's the cheapest
 * way to stop a dark page reading as a flat black rectangle — there's always
 * something faintly moving, so the screen feels alive while idle.
 *
 * Deliberately CSS-only and GPU-composited (transform + opacity, nothing that
 * triggers layout or paint). No WebGL: this has to hold 60fps inside
 * Instagram's in-app WebView on a mid-range Android, which is a much weaker JS
 * environment than real Safari.
 */
export function Aurora({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div
        className="drift absolute -top-40 -right-32 size-[520px] rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.88 0.23 128 / 0.20) 0%, transparent 68%)",
        }}
      />
      <div
        className="drift absolute top-1/3 -left-40 size-[460px] rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.71 0.27 352 / 0.14) 0%, transparent 68%)",
          animationDelay: "-9s",
        }}
      />
      <div
        className="drift absolute -bottom-48 left-1/4 size-[560px] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.82 0.15 205 / 0.12) 0%, transparent 70%)",
          animationDelay: "-17s",
        }}
      />
    </div>
  );
}
