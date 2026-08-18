# Voice Party Game — Build Plan

**Working title:** TBD (see Name Options)
**Concept:** A voice-note party game that spreads through Instagram group chats. Prompt drops, everyone records a voice note in-app, the group votes, the winning clip exports to Stories.
**Positioning:** "The voice note party game." Not another truth-or-dare clone — the format is the differentiator.

---

## 1. Stack Decisions (researched Aug 2026)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16.3 LTS** | Current stable LTS (released Aug 6, 2026). App Router, Turbopack. |
| Styling | **Tailwind CSS v4.3** | Rust/Lightning CSS engine, CSS-native `@theme`, OKLCH color space. v4.1 added text-shadow + mask utilities we want. |
| Animation (primary) | **Motion 13** (`motion`) | MIT, open source, ~16M downloads/mo. Bypasses React's render cycle — animates on the native pipeline, no re-renders. Real spring physics. |
| Animation (choreography) | **GSAP** (selective) | Now 100% free incl. SplitText/MorphSVG. Used *only* for kinetic type reveals and SVG morphing. See license note below. |
| Components | **shadcn/ui** (Base UI variant) | As of Jul 2026 new shadcn projects default to Base UI over Radix. Copy-into-repo, we own the code. |
| Motion patterns | **Motion Primitives / Magic UI** | Cherry-pick source, not a dependency. |
| Character animation | **Rive** | State machines, small files, scales better than Lottie with many simultaneous animations. For reaction/mascot moments only. |
| Realtime | **Cloudflare Durable Objects + PartyServer** | Cloudflare acquired PartyKit; PartyServer is the maintained DO+WebSocket wrapper. One DO per game room = perfect fit. |
| Persistence | **Neon Postgres** + Drizzle | Rooms, prompts, purchases. |
| Media | **Cloudflare R2** + hard TTL | Voice clips, ephemeral. |
| OG cards | **`@vercel/og`** (Satori) | JSX → SVG → PNG at the edge, auto-cached. |
| Payments | **Stripe Checkout** | Group unlock SKU. |

### GSAP license caveat
GSAP is free but **closed source and owned by Webflow**; the license forbids use in products competing with Webflow and Webflow may terminate it at their discretion. We are not a Webflow competitor, so we're fine — but we keep GSAP **isolated to 2–3 reveal components** so it's a 1-day removal if the license ever changes. Motion is the load-bearing library.

---

## 2. Design Direction

### The thesis
This game is played **at night, on a phone, in a group chat, with friends.** Every design decision follows from that. Not a website that happens to work on mobile — a thing that feels like an app you shouldn't have downloaded.

### Visual language
- **Dark-native, not "dark mode."** Near-black base (OKLCH, not hex — smoother gradients, no muddy mid-tones), one hot saturated accent, heavy use of glow rather than shadow.
- **The waveform is the brand.** Voice is the product, so amplitude is the motif: loaders, buttons, dividers, transitions, the Story card. Everything is built from the same shape.
- **Tangible over flat.** 2026's dominant trend is interfaces that feel physical. Elements have weight, overshoot, and settle. Nothing linear-eases.
- **Springs, never curves.** `type: "spring"` as the global default. Motion's spring math is why things read as "alive" instead of "animated."
- **Kinetic type for drama.** Prompt text lands character-by-character with per-glyph stagger. This is where GSAP SplitText earns its place.

### The four money moments
Polish budget goes here, in this order. Everything else can be plain.

**1. The Record Button**
The most-touched element in the app. Press-and-hold. A live amplitude ring driven by real mic input (Web Audio `AnalyserNode` → `useMotionValue`), so the ring breathes with your actual voice. Scale-down on press, glow bloom on release, spring settle. This one component gets a full day.

**2. The Reveal**
The viral moment. Clips play in sequence, waveform scrubs in real time, vote reactions fly in as they land. Should feel like a game show, not a media player. Sequenced with Motion timelines + stagger.

**3. The Story Card**
1080×1920, generated server-side, animated waveform baked in, one tap to share. This is Loop 2 — how you get users outside the original group chat.

**4. The Unfurl Card**
1200×630 dynamic OG. Shows live player avatars and "3 more to unlock." This renders *inside Instagram DMs* and is your entire top-of-funnel. Arguably the highest-ROI surface in the product.

### Satisfaction details
- **Sound design.** A voice game with a silent UI is a miss. Tiny tick/whoosh/thud set, muted by default with an obvious unmute (we open inside IG, autoplay audio is hostile).
- **Optimistic UI everywhere.** Nothing waits on a round-trip.
- **Same-document View Transitions** for screen changes — supported Chrome 111+, Safari 18+, Firefox 144+. Cross-document VT is Chromium-only, so we don't depend on it.
- Rolling number counters on vote tallies. Tasteful particle burst on win.

---

## 3. Hard Platform Constraints

These are the things that quietly kill apps like this.

**Instagram in-app WebView** — links from IG DMs open in IG's WebView, not Safari/Chrome:
- No PWA install prompt
- Apple Pay / Google Pay unavailable
- Passkeys and most OAuth flows break
- → **No login to play.** Anonymous session + device ID, one-tap join.
- → **Checkout breaks out to the system browser** via a signed resume link.

**Audio recording (`MediaRecorder`)**:
- Safari requires `audio/mp4`; Chrome/Firefox use `audio/webm`. **Must feature-detect `isTypeSupported`** — hardcoding webm is the single most common iOS failure.
- Opus is supported on Apple platforms; Vorbis is not.
- iOS Safari 14.5+ only.

**Haptics**:
- Apple does not implement the Vibration API in iOS Safari. `navigator.vibrate` works on Android only.
- iOS needs the `<input switch>` label trick (see `ios-haptics`) — unofficial, may break.
- → Haptics are **enhancement, never load-bearing**. A proper Web Haptics API is still only a WICG proposal.

**Performance budget**:
- IG's WebView is a weaker JS environment than real Safari, and median mobile pages are already multi-MB.
- **No WebGL/three.js on the critical path.** CSS transforms + Motion springs, GPU-composited only.
- Target: 60fps on a mid-range Android inside IG's WebView. That is the real test device, not a MacBook.

---

## 4. Game Lineup

| # | Game | Input | Reveal | Phase |
|---|---|---|---|---|
| 1 | **Voice Roulette** | In-app voice note to a prompt | Sequential playback + live voting | 1 |
| 2 | **Most Likely To** | Tap vote | Tally reveal | 1 |
| 3 | **Paranoia** | Private question, spoken answer | Coin flip exposes the question | 2 |
| 4 | **The Confession Pot** | 3 self-authored confessions at start | Winner picks which one drops | 2 |
| 5 | **Caption This** | In-app camera to a prompt | Photo grid, captions unlock | 3 |

Ship #1 finished before touching anything else. "The voice note party game" is a pitch; five half-games is not.

---

## 5. Monetization

**Group unlock — $4.99.** One player buys, the entire room gets premium prompt packs and power-ups. Social pressure does the selling and willingness-to-pay is far higher than individual unlocks. This is the highest-leverage mechanic in social games and it's the #1 build priority after the core loop.

Secondary: prompt pack singles, Confession Pot power-ups (double / trade), room cosmetics. Ads last — interstitials cost more in virality than they return at this stage.

Realistic ARPU for this category is $0.05–$0.50/MAU. The group-unlock mechanic determines which end you land on.

---

## 6. Safety & Moderation (launch requirements, not optional)

Accepting any user media means this infrastructure ships with v1:
- Age gate at room join
- **Report button in every room**, one tap, always visible
- Automated classifier on every upload (audio, then image in Phase 3)
- Hash-matching against known-bad content
- **Hard TTL on all media** — room-scoped, auto-purged, no permanent retention
- Rate limits per device
- All captures happen **in-app for a specific prompt**, revealed to the group — never sourced from a camera roll or message history, never delivered privately to one player

Audio is materially cheaper and lower-risk to moderate than images, which is the other reason voice ships first.

---

## 7. Phase 1 Scope

1. Next.js 16.3 + Tailwind 4.3 + Motion 13 scaffold, dark OKLCH design tokens
2. Durable Object room server (PartyServer) — join, presence, round state
3. One-tap anonymous join, no auth
4. Record flow with cross-browser mimeType detection + amplitude ring
5. Async round engine — reveal fires when the last player submits
6. Voting + tally reveal
7. Dynamic OG unfurl card
8. Story export card
9. Most Likely To as warmup game
10. Report button + media TTL + age gate
11. Stripe group-unlock

---

## Name Options

Short, brandable, reads well as a bare link in a DM.

1. **Aux** — "give me the aux." Culturally native, 3 letters, instantly understood. *Top pick.*
2. **Yapp** — yapping. Very current, playful, obviously about talking. *Top pick.*
3. **Hotmic** — implies stakes and being caught out. *Top pick.*
4. **Blurt** — impulsive, funny, ownable.
5. **Airtime** — everyone gets a turn.
6. **Loudmouth** — long but memorable.
7. **Soundbite** — clean, slightly corporate.
8. **Bleep** — censorship joke, fits the edge.
9. **Earworm** — sticky, less on-mechanic.
10. **Static** — moody, cool, least descriptive.

---

## Sources

- [Next.js releases](https://nextjs.org/blog/next-16-2) · [EOL data](https://endoflife.date/nextjs)
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4) · [v4.1](https://tailwindcss.com/blog/tailwindcss-v4-1) · [v4.3](https://tailwindcss.com/blog/tailwindcss-v4-3)
- [Motion docs](https://motion.dev/docs/react) · [GSAP vs Motion](https://motion.dev/docs/gsap-vs-motion)
- [Webflow makes GSAP free](https://webflow.com/updates/gsap-becomes-free) · [GSAP license](https://gsap.com/community/standard-license/)
- [Cloudflare acquires PartyKit](https://blog.cloudflare.com/cloudflare-acquires-partykit/) · [Durable Objects](https://developers.cloudflare.com/durable-objects/) · [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [View Transitions support](https://www.lambdatest.com/web-technologies/view-transitions-edge) · [MDN](https://developer.mozilla.org/docs/Web/API/View_Transitions_API)
- [MediaRecorder support](https://caniuse.com/mediarecorder) · [Safari mimeType issue](https://stackoverflow.com/questions/76532656/media-recorder-api-browser-compatibility)
- [Pulsar haptics — iOS limitation](https://docs.swmansion.com/pulsar/sdk/web/) · [WICG Web Haptics](https://github.com/WICG/web-haptics)
- [@vercel/og](https://vercel.com/docs/functions/edge-functions/og-image-generation)
- [shadcn/ui alternatives, Jul 2026](https://ui.aceternity.com/blog/shadcn-ui-alternatives) · [Rive vs Lottie](https://rive.app/blog/rive-as-a-lottie-alternative)
- [Web design trends 2026 — Squarespace](https://pros.squarespace.com/blog/design-trends) · [Sessions.edu](https://www.sessions.edu/notes-on-design/top-web-design-trends/)

*Content from sources was rephrased for compliance with licensing restrictions.*
