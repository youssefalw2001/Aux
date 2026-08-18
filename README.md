# aux

**The voice note party game.** Prompt drops → everyone records a voice note in-app → the group votes → the winning clip exports to Stories.

Built to spread through Instagram group chats. See [`docs/PLAN.md`](docs/PLAN.md) for the full product and design plan.

---

## Status

Phase 1 in progress. What works today:

- ✅ Design system — dark-native OKLCH tokens, waveform motif, spring-first motion
- ✅ **Record button** with live amplitude ring driven by real mic input
- ✅ Cross-browser audio recording (Safari `audio/mp4` vs Chrome `audio/webm`)
- ✅ Waveform playback with rAF-smooth scrubbing
- ✅ Kinetic-type prompt cards
- ✅ **Dynamic unfurl card** — live OG image for Instagram DM previews
- ✅ Room join flow, no auth
- ✅ **Durable Object room server** — realtime presence, async rounds, vote tally
- ✅ **Voting + reveal UI** — anonymous voting, sequenced reveal, rolling vote counts
- ✅ Playable demo mode (`/demo`) with simulated players — no server needed
- ✅ Static export target for GitHub Pages previews
- ⬜ Story export card (1080×1920)
- ⬜ Stripe group unlock
- ⬜ Moderation pipeline (classifier, report, media TTL)

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3 (App Router, Turbopack) |
| Styling | Tailwind CSS v4.3 — CSS-native `@theme`, OKLCH |
| Animation | Motion 13 (MIT) |
| Realtime *(next)* | Cloudflare Durable Objects + PartyServer |
| OG images | `next/og` (Satori) |

## Getting started

```bash
pnpm install
pnpm dev
```

Then open:

- `/` — the round screen (record flow)
- `/r/PARTY` — a room join screen
- `/r/PARTY/opengraph-image` — the unfurl card as Instagram sees it

**Recording requires HTTPS or localhost.** `getUserMedia` is gated behind a secure context, so testing on a phone over LAN IP will silently fail — use a tunnel (`cloudflared`, `ngrok`) instead.

### Smoke test

```bash
./scripts/smoke.sh
```

Boots the app, checks every route, renders the unfurl card to `docs/preview/unfurl-card.png`, and shuts down.

---

## Architecture notes

Things in here that look unusual but are deliberate:

**Amplitude is a MotionValue, not React state.** Mic amplitude updates every frame. As state that would be 60 re-renders/sec. `useRecorder` exposes it as a `MotionValue` so it drives animation off the native pipeline, and throttles the *text* timer to 10Hz separately. See [`src/lib/audio/useRecorder.ts`](src/lib/audio/useRecorder.ts).

**MIME type is negotiated, never hardcoded.** Safari does not support `audio/webm` and requires `audio/mp4`. Hardcoding either ships a broken app to half the users, and it fails *after* mic permission is granted so it looks like a hardware problem. See [`src/lib/audio/mime.ts`](src/lib/audio/mime.ts).

**Haptics are never load-bearing.** Apple does not implement the Vibration API in iOS Safari. `navigator.vibrate` is Android-only. There's an unofficial `<input switch>` workaround for iOS which we use opportunistically, but no interaction depends on it. See [`src/lib/haptics.ts`](src/lib/haptics.ts).

**No login, anywhere.** Links from Instagram DMs open in Instagram's in-app WebView where OAuth and passkeys break, there's no PWA install prompt, and Apple/Google Pay are unavailable. Anonymous session + device ID only; checkout will break out to the system browser.

**The unfurl card is treated as a primary surface.** It renders inside Instagram DMs and is the entire top of funnel, so it gets the brand typeface (with a graceful fallback — a failed font fetch must never break the preview) and states the player gap explicitly to drive invites.

**GSAP is intentionally absent so far.** It's free now, but closed-source and Webflow-owned with a license they can revoke. Motion carries everything; GSAP will be quarantined to the reveal screen only, where per-glyph choreography earns its weight.

## Safety

Non-negotiable for launch, tracked in `docs/PLAN.md`:

- All media is **captured in-app for a specific prompt** and revealed **to the group** — never sourced from a camera roll or message history, never delivered privately to one player
- Age gate at room join
- Report button in every room
- Classifier on every upload + hash matching
- Hard TTL on all media, room-scoped, no permanent retention
