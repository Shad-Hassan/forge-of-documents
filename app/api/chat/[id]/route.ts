// GET /api/chat/:id -> full session. PATCH {title?, archived?} -> rename / archive. Turns are never edited.
import { NextRequest, NextResponse } from "next/server";
import { getChat, updateChat } from "@/lib/chat/store";

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "NOT_FOUND") return NextResponse.json({ error: msg }, { status: 404 });
  if (msg === "BAD_ID") return NextResponse.json({ error: msg }, { status: 400 });
  return NextResponse.json({ error: "Chat request failed" }, { status: 500 });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try { return NextResponse.json({ session: getChat(id) }); } catch (e) { return fail(e); }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  try { return NextResponse.json({ session: updateChat(id, body) }); } catch (e) { return fail(e); }
}
