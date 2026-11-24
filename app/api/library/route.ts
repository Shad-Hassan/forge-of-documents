import { NextRequest, NextResponse, connection } from "next/server";
import { listUploads, deleteUpload } from "@/lib/uploads/store";

export async function GET() {
  // cacheComponents is on: opt out of prerendering so the listing is read per request.
  await connection();
  try {
    return NextResponse.json({ files: await listUploads() });
  } catch {
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const rel = request.nextUrl.searchParams.get("path");
  if (!rel) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }
  try {
    await deleteUpload(rel);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
