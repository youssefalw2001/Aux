import type { Metadata } from "next";
import { Landing } from "./Landing";

/**
 * Entry point.
 *
 * This was previously a bare record screen with no route into the actual game,
 * so anyone landing on the root saw the least impressive surface in the product
 * and had no way forward. The only job of this page is to get someone into a
 * round in one tap.
 */

export const metadata: Metadata = {
  title: "aux — the voice note party game",
  description:
    "A prompt drops. Everyone records a voice note. The group votes on who did it best.",
};

export default function Home() {
  return <Landing playHref="/demo" />;
}
