// POST /api/chat/:id/message {text} -> Server-Sent Events:
//   event: user      {turn}          the saved user turn
//   event: activity  {activity}      a live tool step (Search / Read / Find)
//   event: thinking  {}
//   event: done      {turn}          the saved assistant turn (answer + verified sources)
//   event: error     {error}
// Closing the connection (Stop) aborts the headless session and saves a "Stopped." turn.
import { NextRequest, NextResponse } from "next/server";
import { askChat } from "@/lib/chat/ask";
import { appendTurn, getChat } from "@/lib/chat/store";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 8000) : "";
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  let session;
  try {
    session = getChat(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: msg || "NOT_FOUND" }, { status: msg === "BAD_ID" ? 400 : 404 });
  }

  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* client gone */ }
      };
      try {
        const userTurn = appendTurn(id, { role: "user", text });
        send("user", { turn: userTurn });
        for await (const ev of askChat(session, text, abort.signal)) {
          if (ev.type === "activity") send("activity", { activity: ev.activity });
          else if (ev.type === "thinking") send("thinking", {});
          else if (ev.type === "done") send("done", { turn: appendTurn(id, ev.turn) });
        }
      } catch (e) {
        console.error("chat error:", e);
        send("error", { error: e instanceof Error ? e.message : "Chat failed" });
      } finally {
        try { controller.close(); } catch { /* closed */ }
      }
    },
    cancel() { abort.abort(); },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
