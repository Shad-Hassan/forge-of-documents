// GET /api/chat -> session catalog. POST /api/chat {title?} -> new session.
import { NextRequest, NextResponse, connection } from "next/server";
import { createChat, listChats } from "@/lib/chat/store";
import { backendStatus } from "@/lib/engine/backend";

export async function GET() {
  await connection();
  return NextResponse.json({ sessions: listChats(), status: backendStatus() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ session: createChat(typeof body.title === "string" ? body.title : undefined) });
}
