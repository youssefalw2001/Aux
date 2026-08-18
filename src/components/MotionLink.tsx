"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, PointerEvent } from "react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Internal navigation that actually navigates, on every host we deploy to.
 *
 * Two separate bugs led here, both of which produced a button that animated on
 * tap and then did nothing:
 *
 * 1. GESTURE CAPTURE. Wrapping `<motion.span whileTap>` inside a `<Link>` put
 *    the span on top of the anchor and Motion's press gesture captured the
 *    pointer, so the anchor never saw a click. Verified with
 *    scripts/netdiag.mjs, which reported the topmost element at the anchor's
 *    own centre as the SPAN rather than the A.
 *
 * 2. RSC PAYLOADS ON A STATIC HOST. Even with a clean anchor, App Router client
 *    navigation dies on GitHub Pages. The router requests route data as
 *    `/demo/bottle/?_rsc=<hash>`; a static file server ignores the query and
 *    serves the HTML page. The router can't parse HTML as a flight payload, so
 *    it preventDefaults the click and no-ops. Silent: no console error, no
 *    network request, nothing to grep for.
 *
 * So on the static export we render a real `<a>` and let the browser do a full
 * page load — these pages are small and it's indistinguishable in practice. On
 * the server target `?_rsc=` is handled properly, so we keep `<Link>` and get
 * prefetching and client-side transitions.
 *
 * The press animation is CSS `:active`, not a Motion gesture, so it can never
 * interfere with the click again. Haptics fire on pointerdown, which precedes
 * the click and can't cancel it.
 */

const IS_STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  /** Fire a haptic on press. Defaults on. */
  buzz?: boolean;
};

const PRESS = "transition-transform duration-150 ease-out active:scale-[0.97]";

export function MotionLink({
  buzz = true,
  href,
  className,
  onPointerDown,
  // Pulled out of the spread: it's a Next-only prop and React would warn about
  // an unknown attribute if it reached a raw <a>.
  prefetch,
  ...props
}: Props) {
  const buzzOnPress = (e: PointerEvent<HTMLAnchorElement>) => {
    if (buzz) haptic("tap");
    onPointerDown?.(e);
  };

  if (IS_STATIC_EXPORT) {
    // basePath is not applied to a raw <a>, so add it ourselves.
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const target = href.startsWith("/") ? `${base}${href}` : href;
    // trailingSlash: true on this target — match it so the static host resolves
    // the directory index instead of issuing a redirect.
    const withSlash =
      target.endsWith("/") || target.includes("#") || target.includes("?")
        ? target
        : `${target}/`;

    return (
      <a
        href={withSlash}
        className={cn(PRESS, className)}
        onPointerDown={buzzOnPress}
        {...(props as ComponentProps<"a">)}
      />
    );
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(PRESS, className)}
      onPointerDown={buzzOnPress}
      onClick={props.onClick as (e: MouseEvent<HTMLAnchorElement>) => void}
      {...props}
    />
  );
}
