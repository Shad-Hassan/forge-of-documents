"use client";

// Forge Chat: a scrolling thread over the artifact universe, on headless Claude Code (Shad's own login).
// Sidebar catalog of sessions · live tool activity · verified source cards · Forge any answer.
// Contrast (computed, WCAG): ivory-100/void 16.98, ivory-82/void 11.77, ivory-70/void 9.06,
// bronze text/void 5.13, void-900 on bronze 5.13, ember-500/void-800 5.32. Slate = borders only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdownish from "./Markdownish";

const C = {
  void900: "#0b0f1a", void800: "#0d1117", void700: "#11151f", void600: "#161b2a",
  ivory100: "#f5f1e8", ivory82: "#d1cac0", ivory70: "#bab1a8",
  bronze: "#a67c52", ember: "#ea580c", slate700: "#334155", slate600: "#475569",
};

interface Source { path: string; quote: string; verified: boolean }
interface Activity { tool: string; detail: string; error?: boolean }
type Turn =
  | { id: string; at: string; role: "user"; text: string }
  | { id: string; at: string; role: "assistant"; answer: string; sources: Source[]; activity: Activity[]; costUsd: number; durationMs: number; turns: number; model: string; error?: string };
interface Session { id: string; title: string; updated: string; archived?: boolean; turns: Turn[] }
interface Summary { id: string; title: string; updated: string; archived: boolean; turnCount: number; preview: string }

const FAMILIES = [
  { id: "plexio", name: "plexio" },
  { id: "warden", name: "warden" },
  { id: "replycast", name: "replyCast" },
  { id: "athena", name: "athena" },
];

const SUGGESTIONS = [
  "What's the RentCast ticket number, and when was it logged?",
  "Which artifacts are client-facing, and who are they for?",
  "Summarise what shipped for Vextron in October.",
];

function group(updated: string): string {
  const d = new Date(updated), now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = (day(now) - day(d)) / 86400000;
  return diff < 1 ? "Today" : diff < 2 ? "Yesterday" : diff < 7 ? "Previous 7 days" : "Older";
}

async function* sse(res: Response): AsyncGenerator<{ event: string; data: any }> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const event = chunk.match(/^event: (.*)$/m)?.[1] ?? "message";
      const data = chunk.match(/^data: (.*)$/m)?.[1];
      if (data) yield { event, data: JSON.parse(data) };
    }
  }
}

function ActivityList({ items, live }: { items: Activity[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  if (!items.length && !live) return null;
  const searches = items.filter((a) => a.tool === "Search" || a.tool === "Find").length;
  const reads = items.filter((a) => a.tool === "Read").length;
  const summary = [searches && `${searches} search${searches > 1 ? "es" : ""}`, reads && `${reads} file${reads > 1 ? "s" : ""} read`].filter(Boolean).join(" · ");
  const show = live || open;
  return (
    <div style={{ margin: "0 0 10px" }}>
      {!live && (
        <button className="ch-chip" onClick={() => setOpen(!open)} aria-expanded={open}
          style={{ background: "transparent", border: `1px solid ${C.slate700}`, color: C.ivory82, fontFamily: "inherit", fontSize: 12, padding: "3px 9px", cursor: "pointer", borderRadius: 0 }}>
          {open ? "▾" : "▸"} {summary || "worked"}
        </button>
      )}
      {show && (
        <ol style={{ listStyle: "none", margin: live ? 0 : "8px 0 0", padding: 0, display: "grid", gap: 4 }}>
          {items.map((a, i) => (
            <li key={i} style={{ fontSize: 13, color: C.ivory82, display: "flex", gap: 8 }}>
              <span style={{ color: a.error ? C.ember : C.bronze, minWidth: 54, fontWeight: 700 }}>{a.tool}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</span>
            </li>
          ))}
          {live && <li className="ch-pulse" style={{ fontSize: 13, color: C.ivory70 }}>{items.length ? "Working…" : "Thinking…"}</li>}
        </ol>
      )}
    </div>
  );
}

function SourceCards({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
      <div style={{ color: C.bronze, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Sources</div>
      {sources.map((s, i) => (
        <div key={i} style={{ background: C.void700, border: `1px solid ${s.verified ? C.slate700 : C.ember}`, padding: "10px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <span style={{ color: C.ivory100, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.path}>
              <span style={{ color: C.bronze, fontWeight: 700, marginRight: 8 }}>{i + 1}</span>{s.path}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: s.verified ? C.bronze : C.ember, border: `1px solid ${s.verified ? C.bronze : C.ember}`, padding: "1px 6px", flexShrink: 0 }}>
              {s.verified ? "✓ verified" : "unverified"}
            </span>
          </div>
          <blockquote style={{ margin: "8px 0 0", paddingLeft: 10, borderLeft: `2px solid ${C.slate600}`, color: C.ivory82, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>
            {s.quote}
          </blockquote>
        </div>
      ))}
    </div>
  );
}

function ForgeMenu({ turn, question }: { turn: Extract<Turn, { role: "assistant" }>; question: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id?: string; version?: number; error?: string } | null>(null);
  async function forge(family: string) {
    setBusy(true); setResult(null);
    const sourceList = turn.sources.map((s, i) => `[${i + 1}] ${s.path}: "${s.quote}"`).join("\n");
    const r = await fetch("/api/forge", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: sourceList ? `${turn.answer}\n\nSources:\n${sourceList}` : turn.answer,
        family, title: question.slice(0, 80), question,
        citations: turn.sources.map((s) => ({ source: s.path, title: null, cited_text: s.quote })),
      }),
    });
    setResult(await r.json());
    setBusy(false);
  }
  return (
    <span style={{ position: "relative" }}>
      <button className="ch-chip" onClick={() => setOpen(!open)} disabled={busy} aria-expanded={open}
        style={{ background: "transparent", border: `1px solid ${C.slate600}`, color: C.ivory100, fontFamily: "inherit", fontSize: 12, padding: "4px 10px", cursor: "pointer", borderRadius: 0 }}>
        {busy ? "Forging…" : "Forge this ▾"}
      </button>
      {open && !busy && (
        <span style={{ position: "absolute", bottom: "110%", left: 0, background: C.void800, border: `1px solid ${C.slate600}`, display: "grid", minWidth: 150, zIndex: 5 }}>
          {FAMILIES.map((f) => (
            <button key={f.id} className="ch-chip" onClick={() => { setOpen(false); forge(f.id); }}
              style={{ background: "transparent", border: 0, borderBottom: `1px solid ${C.slate700}`, color: C.ivory100, fontFamily: "inherit", fontSize: 13, padding: "8px 12px", textAlign: "left", cursor: "pointer" }}>
              {f.name}
            </button>
          ))}
        </span>
      )}
      {result?.id && <a href={`/engine/docs/${encodeURIComponent(result.id)}`} style={{ marginLeft: 10, color: C.bronze, fontSize: 12, fontWeight: 700 }}>Open v{result.version} in editor →</a>}
      {result?.error && <span role="alert" style={{ marginLeft: 10, color: C.ember, fontSize: 12 }}>{result.error}</span>}
    </span>
  );
}

export default function Chat() {
  const [sessions, setSessions] = useState<Summary[]>([]);
  const [status, setStatus] = useState<{ backend: string; cli: boolean } | null>(null);
  const [current, setCurrent] = useState<Session | null>(null);
  const [filter, setFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [liveActivity, setLiveActivity] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/chat");
    if (r.ok) { const d = await r.json(); setSessions(d.sessions); setStatus(d.status); }
  }, []);

  const open = useCallback(async (id: string) => {
    const r = await fetch(`/api/chat/${id}`);
    if (!r.ok) return;
    setCurrent((await r.json()).session);
    setError(null);
    window.history.replaceState(null, "", `/chat?c=${id}`);
  }, []);

  useEffect(() => {
    refresh();
    const id = new URLSearchParams(window.location.search).get("c");
    if (id) open(id);
  }, [refresh, open]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [current?.turns.length, liveActivity.length, running]);

  function newChat() {
    setCurrent(null); setError(null); setInput("");
    window.history.replaceState(null, "", "/chat");
    inputRef.current?.focus();
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || running) return;
    setInput(""); setError(null); setRunning(true); setLiveActivity([]);
    let session = current;
    if (!session) {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      session = (await r.json()).session as Session;
      setCurrent(session);
      window.history.replaceState(null, "", `/chat?c=${session.id}`);
    }
    const id = session.id;
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/chat/${id}/message`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: msg }), signal: ac.signal,
      });
      if (!res.ok || !res.body) { setError((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`); return; }
      for await (const { event, data } of sse(res)) {
        if (event === "user") setCurrent((s) => (s ? { ...s, turns: [...s.turns, data.turn] } : s));
        else if (event === "activity") setLiveActivity((a) => [...a, data.activity]);
        else if (event === "done") setCurrent((s) => (s ? { ...s, turns: [...s.turns, data.turn] } : s));
        else if (event === "error") setError(data.error);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Connection lost.");
    } finally {
      setRunning(false); setLiveActivity([]); abortRef.current = null;
      await open(id); // reload the saved thread (includes a "Stopped." turn after Stop)
      refresh();
    }
  }

  function stop() { abortRef.current?.abort(); }

  async function archive(id: string, archived: boolean) {
    await fetch(`/api/chat/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ archived }) });
    if (current?.id === id && archived) newChat();
    refresh();
  }

  async function rename(id: string, title: string) {
    await fetch(`/api/chat/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
    refresh();
  }

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = sessions.filter((s) => s.archived === showArchived && (!q || s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q)));
    const g = new Map<string, Summary[]>();
    for (const s of list) { const k = group(s.updated); g.set(k, [...(g.get(k) ?? []), s]); }
    return [...g.entries()];
  }, [sessions, filter, showArchived]);

  const turns = current?.turns ?? [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr)", height: "100vh", background: C.void900, color: C.ivory100 }} className="ch-root">
      <style>{`
        .ch-chip:hover:not(:disabled), .ch-chip:focus-visible { outline: 2px solid ${C.bronze}; outline-offset: 1px; }
        .ch-btn:hover:not(:disabled), .ch-btn:focus-visible { outline: 2px solid ${C.ivory100}; outline-offset: 2px; }
        .ch-btn:disabled { opacity: .55; cursor: not-allowed; }
        .ch-field:focus { border-color: ${C.bronze} !important; outline: none; }
        .ch-item:hover { background: ${C.void600} !important; }
        .ch-item .ch-arch { visibility: hidden; } .ch-item:hover .ch-arch, .ch-item:focus-within .ch-arch { visibility: visible; }
        @media (prefers-reduced-motion: no-preference) { .ch-pulse { animation: chP 1.4s ease-in-out infinite; } }
        @keyframes chP { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
        @media (max-width: 860px) { .ch-root { grid-template-columns: 1fr !important; } .ch-side { display: none !important; } }
      `}</style>

      {/* Catalog */}
      <aside className="ch-side" style={{ borderRight: `1px solid ${C.slate700}`, background: C.void800, display: "flex", flexDirection: "column", minHeight: 0 }} aria-label="Chats">
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${C.slate700}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <a href="/engine" style={{ color: C.bronze, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none" }}>Forge of Documents II</a>
            <a href="/status" style={{ color: C.bronze, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Status</a>
          </div>
          <div style={{ fontFamily: "var(--font-forge-display), serif", fontSize: 22, margin: "6px 0 12px" }}>Chat</div>
          <button className="ch-btn" onClick={newChat} style={{ width: "100%", background: C.bronze, color: C.void900, border: `1px solid ${C.bronze}`, padding: "10px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", borderRadius: 0 }}>
            + New chat
          </button>
          <input className="ch-field" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter chats" aria-label="Filter chats"
            style={{ width: "100%", marginTop: 10, background: C.void700, color: C.ivory100, border: `1px solid ${C.slate600}`, padding: "8px 10px", fontFamily: "inherit", fontSize: 13, borderRadius: 0 }} />
        </div>
        <nav style={{ flex: 1, overflowY: "auto", padding: "8px 8px 16px" }}>
          {grouped.length === 0 && <p style={{ color: C.ivory70, fontSize: 13, padding: "8px" }}>{showArchived ? "No archived chats." : "No chats yet."}</p>}
          {grouped.map(([label, items]) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ color: C.ivory70, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 8px 4px" }}>{label}</div>
              {items.map((s) => (
                <div key={s.id} className="ch-item" style={{ display: "flex", alignItems: "center", gap: 4, background: current?.id === s.id ? C.void600 : "transparent", borderLeft: `2px solid ${current?.id === s.id ? C.bronze : "transparent"}` }}>
                  <button onClick={() => open(s.id)} onDoubleClick={() => { const t = prompt("Rename chat", s.title); if (t) rename(s.id, t); }}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: 0, color: C.ivory100, fontFamily: "inherit", padding: "8px 8px", cursor: "pointer" }}
                    title={`${s.title} (double-click to rename)`}>
                    <span style={{ display: "block", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                    <span style={{ display: "block", fontSize: 11, color: C.ivory70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.turnCount} message{s.turnCount === 1 ? "" : "s"}{s.preview ? ` · ${s.preview}` : ""}</span>
                  </button>
                  <button className="ch-arch ch-chip" onClick={() => archive(s.id, !s.archived)} aria-label={s.archived ? `Restore ${s.title}` : `Archive ${s.title}`}
                    style={{ background: "transparent", border: 0, color: C.ivory82, fontSize: 12, cursor: "pointer", padding: "4px 6px", fontFamily: "inherit" }}>
                    {s.archived ? "restore" : "archive"}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: `1px solid ${C.slate700}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: C.ivory70 }}>
          <span>{status ? (status.cli ? "Claude Code · your login" : "Claude Code not found") : "…"}</span>
          <button className="ch-chip" onClick={() => setShowArchived(!showArchived)} style={{ background: "transparent", border: 0, color: C.ivory82, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
            {showArchived ? "← chats" : "archived"}
          </button>
        </div>
      </aside>

      {/* Thread */}
      <main style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <header style={{ padding: "14px 28px", borderBottom: `1px solid ${C.slate700}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.title ?? "New chat"}</div>
          <div style={{ fontSize: 12, color: C.ivory70, flexShrink: 0 }}>searches your artifact universe · read-only</div>
        </header>

        <div ref={threadRef} style={{ flex: 1, overflowY: "auto" }} aria-live="polite">
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px 40px" }}>
            {turns.length === 0 && !running && (
              <div style={{ paddingTop: "12vh", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-forge-display), serif", fontSize: 30, marginBottom: 10 }}>Ask the universe</div>
                <p style={{ color: C.ivory82, fontSize: 15, margin: "0 0 24px" }}>Every answer cites the files it came from, and each quote is checked against the file.</p>
                <div style={{ display: "grid", gap: 8, maxWidth: 560, margin: "0 auto" }}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="ch-chip" onClick={() => send(s)}
                      style={{ textAlign: "left", background: C.void800, border: `1px solid ${C.slate700}`, color: C.ivory100, fontFamily: "inherit", fontSize: 14, padding: "12px 14px", cursor: "pointer", borderRadius: 0 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, idx) =>
              t.role === "user" ? (
                <div key={t.id} style={{ display: "flex", justifyContent: "flex-end", margin: "18px 0" }}>
                  <div style={{ maxWidth: "78%", background: C.void600, border: `1px solid ${C.slate700}`, padding: "10px 14px", fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{t.text}</div>
                </div>
              ) : (
                <div key={t.id} style={{ margin: "18px 0 28px" }}>
                  <ActivityList items={t.activity} live={false} />
                  {t.error ? (
                    <p role="alert" style={{ color: C.ivory100, background: C.void800, borderLeft: `3px solid ${C.ember}`, padding: "10px 14px", margin: 0 }}>{t.error}</p>
                  ) : (
                    <div style={{ fontSize: 15.5, lineHeight: 1.65 }}><Markdownish text={t.answer} /></div>
                  )}
                  <SourceCards sources={t.sources} />
                  {!t.error && (
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                      <button className="ch-chip" onClick={() => navigator.clipboard.writeText(t.answer)}
                        style={{ background: "transparent", border: `1px solid ${C.slate600}`, color: C.ivory100, fontFamily: "inherit", fontSize: 12, padding: "4px 10px", cursor: "pointer", borderRadius: 0 }}>Copy</button>
                      <ForgeMenu turn={t} question={(turns[idx - 1] as { text?: string })?.text ?? current?.title ?? "Forged answer"} />
                      <span style={{ fontSize: 11, color: C.ivory70 }}>
                        {(t.durationMs / 1000).toFixed(1)}s · {t.turns} steps · ≈${t.costUsd.toFixed(4)} of plan usage
                      </span>
                    </div>
                  )}
                </div>
              ),
            )}

            {running && (
              <div style={{ margin: "18px 0" }}>
                <ActivityList items={liveActivity} live />
              </div>
            )}
            {error && <p role="alert" style={{ color: C.ivory100, background: C.void800, borderLeft: `3px solid ${C.ember}`, padding: "10px 14px" }}>{error}</p>}
          </div>
        </div>

        {/* Composer */}
        <div style={{ borderTop: `1px solid ${C.slate700}`, padding: "14px 24px 18px", background: C.void900 }}>
          <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <label htmlFor="msg" style={{ position: "absolute", left: -9999 }}>Message</label>
            <textarea
              id="msg" ref={inputRef} className="ch-field" value={input} rows={1} placeholder="Ask anything about your artifacts…"
              onChange={(e) => { setInput(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 220)}px`; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              style={{ flex: 1, resize: "none", background: C.void700, color: C.ivory100, border: `1px solid ${C.slate600}`, padding: "12px 14px", fontFamily: "inherit", fontSize: 15, lineHeight: 1.5, borderRadius: 0, maxHeight: 220 }}
            />
            {running ? (
              <button className="ch-btn" onClick={stop} style={{ background: "transparent", color: C.ivory100, border: `1px solid ${C.ember}`, padding: "12px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer", borderRadius: 0 }}>Stop</button>
            ) : (
              <button className="ch-btn" onClick={() => send()} disabled={!input.trim()} style={{ background: C.bronze, color: C.void900, border: `1px solid ${C.bronze}`, padding: "12px 18px", fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer", borderRadius: 0 }}>Send</button>
            )}
          </div>
          <div style={{ maxWidth: 820, margin: "6px auto 0", fontSize: 11, color: C.ivory70 }}>Enter to send · Shift+Enter for a new line · runs on your Claude Code plan</div>
        </div>
      </main>
    </div>
  );
}
