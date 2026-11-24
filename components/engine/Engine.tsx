"use client";

// Engine of Artifact: ask the universe, read the cited answer, forge it into a family.
// Contrast (computed, WCAG): ivory-100/void 16.98, ivory-82/void 11.77, ivory-70/void 9.06,
// bronze-600 text on void 5.13, void-900 text on bronze-600 5.13. Slate is borders only.
import { useCallback, useEffect, useRef, useState } from "react";

type FamilyId = "replycast" | "plexio" | "warden" | "athena";
interface Citation { source: string; title: string | null; cited_text: string }
interface Part { text: string; citations: Citation[] }
interface Route { intent: string; family: FamilyId | null; gen: number | null; by: string; ms: number }
interface AskResponse {
  route?: Route;
  parts?: Part[];
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
  iterations?: number;
  error?: string;
}
interface Upload { path: string; bytes: number; mtime: string; sidecar: boolean }
interface ForgedFile { kind: string; path: string; bytes: number }
interface DocSummary { id: string; title: string; family: string; generation: number; audience: string; updated: string; versions: number }
interface ForgeResponse { id?: string; slug?: string; version?: number; files?: ForgedFile[]; skipped?: string[]; error?: string; usage?: { input_tokens: number; output_tokens: number } }

const C = {
  void900: "#0b0f1a", void800: "#0d1117", void700: "#11151f", void600: "#161b2a",
  ivory100: "#f5f1e8", ivory82: "#d1cac0", ivory70: "#bab1a8",
  bronze: "#a67c52", ember: "#ea580c", arcane: "#7c3aed",
  slate700: "#334155", slate600: "#475569",
};

const FAMILIES: Array<{ id: FamilyId; name: string; blurb: string }> = [
  { id: "plexio", name: "plexio", blurb: "Note, report or email in house style" },
  { id: "warden", name: "warden", blurb: "Internal brief, frost print" },
  { id: "replycast", name: "replyCast", blurb: "Email reply, exactly as written" },
  { id: "athena", name: "athena", blurb: "Bento command center (Gen 3)" },
];

const card: React.CSSProperties = { background: C.void800, border: `1px solid ${C.slate700}`, padding: 24 };
const eyebrow: React.CSSProperties = { color: C.bronze, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" };
const input: React.CSSProperties = {
  width: "100%", background: C.void700, color: C.ivory100, border: `1px solid ${C.slate600}`,
  padding: "12px 14px", fontFamily: "inherit", fontSize: 15, borderRadius: 0, outline: "none",
};

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const { variant = "primary", style, ...rest } = props;
  const base: React.CSSProperties =
    variant === "primary"
      ? { background: C.bronze, color: C.void900, border: `1px solid ${C.bronze}` }
      : { background: "transparent", color: C.ivory100, border: `1px solid ${C.slate600}` };
  return (
    <button
      {...rest}
      className="forge-btn"
      style={{ ...base, padding: "12px 16px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", cursor: rest.disabled ? "not-allowed" : "pointer", opacity: rest.disabled ? 0.55 : 1, borderRadius: 0, ...style }}
    />
  );
}

function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export default function Engine() {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [openCite, setOpenCite] = useState<number | null>(null);

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [uploadMsg, setUploadMsg] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [family, setFamily] = useState<FamilyId>("plexio");
  const [gen, setGen] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState("");
  const [forging, setForging] = useState(false);
  const [forged, setForged] = useState<ForgeResponse | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    const r = await fetch("/api/library");
    if (r.ok) setUploads((await r.json()).files ?? []);
    const d = await fetch("/api/docs");
    if (d.ok) setDocs((await d.json()).docs ?? []);
  }, []);
  useEffect(() => { refreshLibrary(); }, [refreshLibrary]);

  // Flatten citations into one numbered source list.
  const sources: Citation[] = [];
  const keyOf = (c: Citation) => `${c.source}::${c.cited_text}`;
  const indexOf = new Map<string, number>();
  for (const p of answer?.parts ?? []) for (const c of p.citations) {
    if (!indexOf.has(keyOf(c))) { indexOf.set(keyOf(c), sources.length); sources.push(c); }
  }
  const answerText = (answer?.parts ?? []).map((p) => p.text).join("");

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true); setAnswer(null); setOpenCite(null); setForged(null); setPreview(null);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const data: AskResponse = await r.json();
      setAnswer(data);
      if (data.route?.family) setFamily(data.route.family);
      if (data.route?.gen != null) setGen(data.route.gen);
      if (!title) setTitle(question.slice(0, 80));
    } catch {
      setAnswer({ error: "Network error" });
    } finally {
      setAsking(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("file", f);
    setUploadMsg("Uploading…");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await r.json();
    const ok = (data.results ?? []).filter((x: { ok: boolean }) => x.ok).length;
    const bad = (data.results ?? []).filter((x: { ok: boolean }) => !x.ok).map((x: { name: string; error: string }) => `${x.name}: ${x.error}`);
    setUploadMsg(`${ok} uploaded${bad.length ? ` · ${bad.join(" · ")}` : ""}`);
    refreshLibrary();
  }

  async function remove(path: string) {
    await fetch(`/api/library?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    refreshLibrary();
  }

  async function doForge() {
    if (!answerText || forging) return;
    setForging(true); setForged(null); setPreview(null);
    const sourceList = sources.map((s, i) => `[${i + 1}] ${s.title ?? s.source} (${s.source}): "${s.cited_text}"`).join("\n");
    const content = sources.length ? `${answerText}\n\nSources:\n${sourceList}` : answerText;
    try {
      const r = await fetch("/api/forge", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, family, gen, title: title || "Forged artifact", direction: direction || undefined, question, citations: sources }),
      });
      const data: ForgeResponse = await r.json();
      setForged(data);
      const first = data.files?.find((f) => f.kind === "web") ?? data.files?.find((f) => f.kind === "email");
      if (first) setPreview(first.path);
      refreshLibrary();
    } catch {
      setForged({ error: "Network error" });
    } finally {
      setForging(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: C.void900, color: C.ivory100, padding: "40px 32px 64px" }}>
      <style>{`
        .forge-btn:hover:not(:disabled), .forge-btn:focus-visible { outline: 2px solid ${C.ivory100}; outline-offset: 2px; }
        .forge-field:focus { border-color: ${C.bronze} !important; outline: 2px solid ${C.bronze}; outline-offset: 0; }
        .forge-chip:hover, .forge-chip:focus-visible { outline: 2px solid ${C.bronze}; outline-offset: 1px; }
        .forge-grid { display: grid; gap: 24px; grid-template-columns: repeat(12, minmax(0, 1fr)); }
        .span-8 { grid-column: span 8; } .span-4 { grid-column: span 4; } .span-12 { grid-column: span 12; }
        @media (max-width: 1024px) { .span-8, .span-4 { grid-column: span 12; } }
        @media (prefers-reduced-motion: no-preference) { .forge-pulse { animation: forgePulse 1.4s ease-in-out infinite; } }
        @keyframes forgePulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
      `}</style>

      <header style={{ maxWidth: 1320, margin: "0 auto 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={eyebrow}>Forge of Documents II</div>
          <span style={{ display: "flex", gap: 16 }}>
            <a href="/chat" className="forge-chip" style={{ color: C.bronze, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Chat →</a>
            <a href="/status" className="forge-chip" style={{ color: C.bronze, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Status →</a>
          </span>
        </div>
        <h1 style={{ fontFamily: "var(--font-forge-display), serif", fontSize: 36, lineHeight: 1.2, fontWeight: 400, margin: "8px 0 8px" }}>
          Engine of Artifact
        </h1>
        <p style={{ color: C.ivory82, fontSize: 15, lineHeight: 1.5, margin: 0, maxWidth: 760 }}>
          Ask the artifact universe. Every answer cites its files. Forge any answer into a family.
        </p>
      </header>

      <div className="forge-grid" style={{ maxWidth: 1320, margin: "0 auto" }}>
        {/* ASK */}
        <section className="span-8" style={{ ...card, gridRow: "span 2" }} aria-labelledby="ask-h">
          <div id="ask-h" style={eyebrow}>Ask</div>
          <form onSubmit={ask} style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <label htmlFor="q" style={{ position: "absolute", left: -9999 }}>Question</label>
            <input
              id="q" className="forge-field" style={input} value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="What did we ship for Vextron in October?" autoComplete="off"
            />
            <Button type="submit" disabled={asking || !question.trim()}>{asking ? "Searching…" : "Ask"}</Button>
          </form>

          {answer?.route && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, fontSize: 12, color: C.ivory70 }}>
              <span style={{ border: `1px solid ${C.slate600}`, padding: "4px 8px" }}>intent · {answer.route.intent}</span>
              <span style={{ border: `1px solid ${C.slate600}`, padding: "4px 8px" }}>routed by {answer.route.by} · {answer.route.ms} ms</span>
              {answer.iterations != null && <span style={{ border: `1px solid ${C.slate600}`, padding: "4px 8px" }}>{answer.iterations} turns</span>}
              {answer.usage && (
                <span style={{ border: `1px solid ${C.slate600}`, padding: "4px 8px" }}>
                  {answer.usage.input_tokens.toLocaleString()} in · {answer.usage.output_tokens.toLocaleString()} out
                </span>
              )}
            </div>
          )}

          <div aria-live="polite" style={{ marginTop: 20 }}>
            {asking && <p className="forge-pulse" style={{ color: C.ivory82 }}>Searching the universe…</p>}
            {answer?.error && (
              <p role="alert" style={{ color: C.ivory100, background: C.void700, borderLeft: `3px solid ${C.ember}`, padding: "12px 14px" }}>
                {answer.error}
              </p>
            )}
            {answer?.parts && (
              <div style={{ fontSize: 16, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {answer.parts.map((p, i) => (
                  <span key={i}>
                    {p.text}
                    {p.citations.map((c) => {
                      const n = indexOf.get(keyOf(c))!;
                      return (
                        <button
                          key={`${i}-${n}`} className="forge-chip" onClick={() => setOpenCite(openCite === n ? null : n)}
                          aria-label={`Source ${n + 1}: ${c.title ?? c.source}`}
                          style={{ margin: "0 2px", padding: "0 6px", fontSize: 12, fontFamily: "inherit", color: C.bronze, background: C.void900, border: `1px solid ${C.bronze}`, borderRadius: 0, cursor: "pointer", verticalAlign: "super" }}
                        >
                          {n + 1}
                        </button>
                      );
                    })}
                  </span>
                ))}
              </div>
            )}
          </div>

          {sources.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={eyebrow}>Sources</div>
              <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 8 }}>
                {sources.map((s, n) => (
                  <li key={n} style={{ background: C.void700, border: `1px solid ${openCite === n ? C.bronze : C.slate700}`, padding: "10px 12px" }}>
                    <button
                      className="forge-chip" onClick={() => setOpenCite(openCite === n ? null : n)} aria-expanded={openCite === n}
                      style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
                    >
                      <span style={{ color: C.bronze, fontWeight: 700, marginRight: 10 }}>{n + 1}</span>
                      <span style={{ color: C.ivory100 }}>{s.title ?? s.source}</span>
                      <span style={{ color: C.ivory70, fontSize: 12, marginLeft: 10 }}>{s.source}</span>
                    </button>
                    {openCite === n && (
                      <blockquote style={{ margin: "10px 0 0", paddingLeft: 12, borderLeft: `2px solid ${C.bronze}`, color: C.ivory82, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                        {s.cited_text}
                      </blockquote>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* LIBRARY */}
        <section className="span-4" style={card} aria-labelledby="lib-h">
          <div id="lib-h" style={eyebrow}>Library</div>
          <p style={{ color: C.ivory70, fontSize: 13, lineHeight: 1.4, margin: "10px 0 14px" }}>
            artifactHtml is searched read-only. Uploads add to it.
          </p>
          <div
            role="button" tabIndex={0} className="forge-chip"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
            style={{ border: `1px dashed ${dragging ? C.bronze : C.slate600}`, background: dragging ? C.void600 : C.void700, padding: "22px 14px", textAlign: "center", color: C.ivory82, fontSize: 14, cursor: "pointer" }}
          >
            Drop PDF, DOCX, TXT, MD or HTML, or click to choose
          </div>
          <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md,.html" hidden onChange={(e) => upload(e.target.files)} />
          <div style={{ ...eyebrow, marginTop: 20 }}>Documents</div>
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 6 }}>
            {docs.length === 0 && <li style={{ color: C.ivory70, fontSize: 13 }}>Nothing forged yet.</li>}
            {docs.map((d) => (
              <li key={d.id} style={{ borderBottom: `1px solid ${C.slate700}`, padding: "6px 0" }}>
                <a href={`/engine/docs/${encodeURIComponent(d.id)}`} className="forge-chip" style={{ color: C.ivory100, fontSize: 13, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.title}>{d.title}</a>
                <span style={{ fontSize: 11, color: C.ivory70 }}>{d.family} · gen {d.generation} · v{d.versions}{d.audience === "client-facing" ? " · client-facing" : ""}</span>
              </li>
            ))}
          </ul>
          {uploadMsg && <p style={{ color: C.ivory82, fontSize: 13, margin: "10px 0 0" }}>{uploadMsg}</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 6 }}>
            {uploads.length === 0 && <li style={{ color: C.ivory70, fontSize: 13 }}>No uploads yet.</li>}
            {uploads.map((u) => (
              <li key={u.path} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.slate700}`, padding: "6px 0" }}>
                <span style={{ fontSize: 13, color: C.ivory100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={u.path}>{u.path}</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: C.ivory70 }}>{fmtBytes(u.bytes)}</span>
                  <button className="forge-chip" onClick={() => remove(u.path)} aria-label={`Delete ${u.path}`}
                    style={{ background: "transparent", color: C.ivory82, border: `1px solid ${C.slate600}`, fontFamily: "inherit", fontSize: 12, padding: "2px 8px", cursor: "pointer", borderRadius: 0 }}>
                    delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* FORGE */}
        <section className="span-4" style={card} aria-labelledby="forge-h">
          <div id="forge-h" style={eyebrow}>Forge it</div>
          <div role="radiogroup" aria-label="Family" style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {FAMILIES.map((f) => (
              <button
                key={f.id} role="radio" aria-checked={family === f.id} className="forge-chip" onClick={() => setFamily(f.id)}
                style={{ textAlign: "left", background: family === f.id ? C.void600 : C.void700, border: `1px solid ${family === f.id ? C.bronze : C.slate700}`, color: C.ivory100, padding: "10px 12px", fontFamily: "inherit", cursor: "pointer", borderRadius: 0 }}
              >
                <span style={{ fontWeight: 700, color: family === f.id ? C.bronze : C.ivory100 }}>{f.name}</span>
                <span style={{ display: "block", fontSize: 12, color: C.ivory70, marginTop: 2 }}>{f.blurb}</span>
              </button>
            ))}
          </div>

          <div role="radiogroup" aria-label="Generation" style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {[0, 1, 2, 3].map((g) => (
              <button
                key={g} role="radio" aria-checked={gen === g} className="forge-chip" onClick={() => setGen(g)}
                style={{ flex: 1, padding: "8px 0", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 0, background: gen === g ? C.bronze : C.void700, color: gen === g ? C.void900 : C.ivory100, border: `1px solid ${gen === g ? C.bronze : C.slate700}` }}
              >
                Gen {g}
              </button>
            ))}
          </div>

          <label htmlFor="ft" style={{ display: "block", fontSize: 12, color: C.ivory82, margin: "16px 0 6px" }}>Title</label>
          <input id="ft" className="forge-field" style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject or page title" />
          <label htmlFor="fd" style={{ display: "block", fontSize: 12, color: C.ivory82, margin: "12px 0 6px" }}>Direction (optional)</label>
          <input id="fd" className="forge-field" style={input} value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="e.g. three bullets, for Zarif" />

          <Button onClick={doForge} disabled={!answerText || forging} style={{ width: "100%", marginTop: 16 }}>
            {forging ? "Forging…" : answerText ? "Forge" : "Ask something first"}
          </Button>

          {forged?.error && <p role="alert" style={{ color: C.ivory100, borderLeft: `3px solid ${C.ember}`, padding: "8px 12px", marginTop: 12, background: C.void700 }}>{forged.error}</p>}
          {forged?.files && (
            <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 6 }}>
              {forged.files.map((f) => (
                <li key={f.path} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                  <button className="forge-chip" onClick={() => setPreview(f.path)} disabled={!/\.(html|txt|md)$/.test(f.path)}
                    style={{ all: "unset", cursor: "pointer", color: preview === f.path ? C.bronze : C.ivory100 }}>
                    {f.path.split("/").pop()}
                  </button>
                  <a href={`/api/out?path=${encodeURIComponent(f.path)}&download=1`} style={{ color: C.ivory82, fontSize: 12 }}>
                    {fmtBytes(f.bytes)} ↓
                  </a>
                </li>
              ))}
              {forged.skipped?.map((s) => <li key={s} style={{ fontSize: 12, color: C.ivory70 }}>skipped: {s}</li>)}
              {forged.id && (
                <li><a href={`/engine/docs/${encodeURIComponent(forged.id)}`} className="forge-chip" style={{ display: "inline-block", marginTop: 8, color: C.bronze, fontWeight: 700, fontSize: 13 }}>Open v{forged.version} in editor →</a></li>
              )}
            </ul>
          )}
        </section>

        {/* PREVIEW */}
        {preview && (
          <section className="span-12" style={{ ...card, padding: 0 }} aria-label="Preview">
            <div style={{ ...eyebrow, padding: "14px 24px", borderBottom: `1px solid ${C.slate700}` }}>Preview · {preview}</div>
            <iframe
              title={`Preview of ${preview}`} sandbox="" src={`/api/out?path=${encodeURIComponent(preview)}`}
              style={{ width: "100%", height: 720, border: 0, background: "#ffffff" }}
            />
          </section>
        )}
      </div>
    </main>
  );
}
