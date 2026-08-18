/**
 * End-to-end test of the room Durable Object.
 *
 * Drives three real WebSocket clients through a full round — join, start,
 * submit, vote — and asserts the phase machine advances correctly and votes
 * tally. Run against `wrangler dev` (see scripts/room-test.sh).
 *
 * Uses Node's built-in WebSocket (Node 22+), no dependency needed.
 */

const BASE = process.env.ROOM_URL ?? "ws://localhost:8787";
const ROOM = `T${Date.now().toString(36).slice(-5).toUpperCase()}`;
const URL_ = `${BASE}/parties/aux-room/${ROOM}`;

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}`);
  if (!cond) failures++;
};

function client(name, deviceId) {
  const ws = new WebSocket(URL_);
  const c = { name, deviceId, ws, state: null, playerId: null, errors: [] };

  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "state") c.state = msg.state;
    else if (msg.type === "you") c.playerId = msg.playerId;
    else if (msg.type === "error") c.errors.push(msg);
  });

  c.send = (obj) => ws.send(JSON.stringify(obj));
  c.open = new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  return c;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait until predicate holds on a client's latest state, or time out. */
async function until(c, pred, label, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (c.state && pred(c.state)) return true;
    await sleep(60);
  }
  console.log(
    `  ! timed out waiting for ${label}; last phase=${c.state?.phase}`,
  );
  return false;
}

async function main() {
  console.log(`\nRoom: ${ROOM}\n${URL_}\n`);

  const a = client("Maya", "dev-a");
  const b = client("Dre", "dev-b");
  const c = client("Priya", "dev-c");
  const all = [a, b, c];

  await Promise.all(all.map((x) => x.open));
  console.log("── connect");
  check("3 sockets open", all.every((x) => x.ws.readyState === 1));

  console.log("── join");
  for (const x of all) x.send({ type: "join", deviceId: x.deviceId, name: x.name });
  await until(a, (s) => s.players.length === 3, "3 players");
  check("3 players in room", a.state?.players.length === 3);
  check("player ids assigned", all.every((x) => x.playerId === x.deviceId));
  check("phase is lobby", a.state?.phase === "lobby");

  console.log("── reconnect resumes the same player (IG WebView case)");
  const aAgain = client("Maya", "dev-a");
  await aAgain.open;
  aAgain.send({ type: "join", deviceId: "dev-a", name: "Maya" });
  await until(aAgain, (s) => s.players.length === 3, "still 3 players");
  check(
    "reconnect did NOT create a ghost player",
    aAgain.state?.players.length === 3,
  );
  aAgain.ws.close();

  console.log("── start round");
  a.send({ type: "start" });
  await until(a, (s) => s.phase === "recording", "recording");
  check("phase is recording", a.state?.phase === "recording");
  check("round is 1", a.state?.round === 1);
  check("prompt assigned", typeof a.state?.prompt === "string" && a.state.prompt.length > 0);

  console.log("── submit clips");
  const peaks = Array.from({ length: 40 }, (_, i) => (i % 9) / 9);
  a.send({ type: "submit", clipUrl: "https://r2/a.m4a", peaks, durationMs: 8200 });
  await until(a, (s) => s.submissions.length === 1, "1 submission");
  check(
    "clip URL withheld during recording",
    a.state?.submissions[0]?.clipUrl === undefined,
  );

  a.send({ type: "submit", clipUrl: "https://r2/a2.m4a", peaks, durationMs: 900 });
  await sleep(250);
  check("duplicate submit rejected", a.errors.some((e) => e.code === "already_submitted"));

  b.send({ type: "submit", clipUrl: "https://r2/b.m4a", peaks, durationMs: 7100 });
  c.send({ type: "submit", clipUrl: "https://r2/c.webm", peaks, durationMs: 11400 });

  console.log("── auto-advance on last submit");
  await until(a, (s) => s.phase === "voting", "voting");
  check("phase auto-advanced to voting", a.state?.phase === "voting");
  check("clip URLs now exposed", a.state?.submissions.every((s) => !!s.clipUrl));

  console.log("── vote");
  a.send({ type: "vote", targetId: "dev-a" });
  await sleep(250);
  check("self-vote rejected", a.errors.some((e) => e.code === "self_vote"));

  a.send({ type: "vote", targetId: "dev-b" });
  c.send({ type: "vote", targetId: "dev-b" });
  b.send({ type: "vote", targetId: "dev-c" });

  console.log("── auto-advance to reveal");
  await until(a, (s) => s.phase === "reveal", "reveal");
  check("phase auto-advanced to reveal", a.state?.phase === "reveal");

  const subs = a.state?.submissions ?? [];
  const byId = Object.fromEntries(subs.map((s) => [s.playerId, s.votes]));
  check("dev-b tallied 2 votes", byId["dev-b"] === 2);
  check("dev-c tallied 1 vote", byId["dev-c"] === 1);
  check("dev-a tallied 0 votes", byId["dev-a"] === 0);
  check(
    "winner is dev-b",
    a.state?.winners.length === 1 && a.state.winners[0] === "dev-b",
  );

  console.log("── next round");
  b.send({ type: "advance" });
  await until(a, (s) => s.round === 2, "round 2");
  check("round advanced to 2", a.state?.round === 2);
  check("phase back to recording", a.state?.phase === "recording");
  check("submissions cleared", a.state?.submissions.length === 0);

  for (const x of all) x.ws.close();
  await sleep(200);

  console.log(
    `\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s) failed`}\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nharness error:", e);
  process.exit(1);
});
