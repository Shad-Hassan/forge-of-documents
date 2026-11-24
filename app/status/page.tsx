// /status: the project explains itself. Source of truth is docs/STATUS.md (a real Obsidian note);
// live counters are read at request time so "where things stand" is never stale.
import { Suspense } from "react";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { connection } from "next/server";
import { Cinzel_Decorative, JetBrains_Mono } from "next/font/google";
import { Blocks, Properties, parseFrontmatter } from "@/components/status/ObsidianNote";
import { listDocs } from "@/lib/docs/store";
import { listChats } from "@/lib/chat/store";
import { backendStatus } from "@/lib/engine/backend";
import { FAMILIES } from "@/lib/families";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-forge-mono" });
const display = Cinzel_Decorative({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-forge-display" });

export const metadata = { title: "Status · Forge of Documents II" };

const NOTE = path.join(process.cwd(), "docs/STATUS.md");

async function Note() {
  await connection(); // live counters: render per request
  const { props, body } = parseFrontmatter(readFileSync(NOTE, "utf8"));
  const docs = listDocs();
  const chats = listChats().filter((c) => !c.archived);
  const b = backendStatus();
  const uploads = path.join(process.cwd(), "data/uploads");
  const uploadCount = existsSync(uploads) ? readdirSync(uploads).filter((f) => !f.endsWith(".docx.txt")).length : 0;
  const live: Array<[string, string]> = [
    ["backend", b.backend === "api" ? "Anthropic API" : b.cli ? "Claude Code headless · your login" : "none available"],
    ["documents", `${docs.length} (${docs.reduce((n, d) => n + d.versions, 0)} versions)`],
    ["chats", String(chats.length)],
    ["uploads", String(uploadCount)],
    ["families", Object.keys(FAMILIES).join(", ") + ", thread (CLI)"],
  ];
  return (
    <>
      <Properties props={props} live={live} />
      <Blocks src={body} />
      <p style={{ marginTop: 32, color: "#bab1a8", fontSize: 12 }}>
        Source: <code>app/docs/STATUS.md</code> (opens as-is in Obsidian). Counters above are live.
      </p>
    </>
  );
}

export default function StatusPage() {
  return (
    <div className={`${mono.variable} ${display.variable}`} style={{ fontFamily: "var(--font-forge-mono), monospace", background: "#0b0f1a", minHeight: "100vh", color: "#f5f1e8" }}>
      <nav style={{ borderBottom: "1px solid #334155", padding: "12px 28px", display: "flex", gap: 18, fontSize: 13 }}>
        <a href="/chat" style={{ color: "#a67c52", fontWeight: 700, textDecoration: "none" }}>Chat</a>
        <a href="/engine" style={{ color: "#a67c52", fontWeight: 700, textDecoration: "none" }}>Engine</a>
        <span style={{ color: "#f5f1e8", fontWeight: 700 }}>Status</span>
      </nav>
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px 64px", fontSize: 15, lineHeight: 1.65 }}>
        <Suspense fallback={<p style={{ color: "#d1cac0" }}>Loading…</p>}>
          <Note />
        </Suspense>
      </main>
    </div>
  );
}
