import { routePartykitRequest } from "partyserver";

export { AuxRoom } from "./AuxRoom";

/**
 * Worker entry. Routes `/parties/aux-room/:code` to the Durable Object for
 * that room code.
 *
 * Deployed separately from the Next app: the Next app is the surface (pages,
 * OG cards, checkout), this is the realtime coordination layer.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "aux-rooms" });
    }

    const routed = await routePartykitRequest(request, env, {
      prefix: "parties",
    });
    if (routed) return routed;

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
