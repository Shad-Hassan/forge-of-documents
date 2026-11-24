"use client";

// Document editor: JSON draft (validated live) ⇄ preview rendered in the browser by the same TS
// renderers the server uses. Save = new version (append-only). Revise = Claude proposes, you accept.
// Contrast pairs used (computed): ivory-100/void 16.98, ivory-82/void 11.77, ivory-70/void 9.06,
// bronze text/void 5.13, void-900 text/bronze 5.13, ember-500/void-800 5.32. Slate is borders only.
import { useCallback, useEffect, useMemo, useState } from "react";
import { FAMILIES } from "@/lib/families";
import { compact, lineDiff } from "@/lib/docs/diff";
import type { FamilyId, OutputKind } from "@/lib/engine/types";

const C = {
  void900: "#0b0f1a", void800: "#0d1117", void700: "#11151f", void600: "#161b2a",
  ivory100: "#f5f1e8", ivory82: "#d1cac0", ivory70: "#bab1a8",
  bronze: "#a67c52", ember: "#ea580c", slate700: "#334155", slate600: "#475569",
};

interface Version { n: number; created: string; by: string; note?: string; outputs: Array<{ kind: string; file: string; bytes: number }> }
interface Doc { id: string; title: string; family: FamilyId; generation: number; audience: string; versions: Version[] }
interface Issue { path: string; message: string }

const eyebrow: React.CSSProperties = { color: C.bronze, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" };
const panel: React.CSSProperties = { background: C.void800, border: `1px solid ${C.slate700}`, padding: 20 };
const btn = (primary: boolean): React.CSSProperties => ({
  background: primary ? C.bronze : "transparent", color: primary ? C.void900 : C.ivory100,
  border: `1px solid ${primary ? C.bronze : C.slate600}`, padding: "10px 14px", fontFamily: "inherit",
  fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 0,
});

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

export default function DocEditor({ id }: { id: string }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [baseText, setBaseText] = useState("");      // draft of the version being edited
  const [text, setText] = useState("");              // working draft
  const [kind, setKind] = useState<OutputKind>("email");
  const [preview, setPreview] = useState<{ html: string } | { error: string }>({ html: "" });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<string | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);
  const [compareText, setCompareText] = useState("");

  const family = doc ? FAMILIES[doc.family] : null;

  const load = useCallback(async (v?: number) => {
    const r = await fetch(`/api/docs/${encodeURIComponent(id)}${v ? `?v=${v}` : ""}`);
    const data = await r.json();
    if (!r.ok) { setStatus(data.error ?? "Load failed"); return; }
    setDoc(data.doc);
    const t = pretty(data.draft);
    setBaseText(t); setText(t); setProposal(null);
    const fam = FAMILIES[data.doc.family as FamilyId];
    if (fam && !fam.kinds.includes(kind)) setKind(fam.kinds[0]);
  }, [id, kind]);

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate + render in the browser, debounced.
  useEffect(() => {
    if (!family) return;
    const t = setTimeout(() => {
      let parsed: unknown;
      try { parsed = JSON.parse(text); setJsonError(null); }
      catch (e) { setJsonError((e as Error).message); return; }
      const res = family.schema.safeParse(parsed);
      if (!res.success) {
        setIssues(res.error.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message })));
        return;
      }
      setIssues([]);
      try { setPreview({ html: family.render(res.data, kind) }); }
      catch (e) {
        const msg = (e as Error).message;
        setPreview({ error: /remote <img>/.test(msg) ? "This view has remote images. They're inlined when you save, so open the saved version's file to see them." : msg });
      }
    }, 150);
    return () => clearTimeout(t);
  }, [text, kind, family]);

  const dirty = text !== baseText;
  const latest = doc?.versions.at(-1)?.n ?? 0;
  const canSave = dirty && !jsonError && issues.length === 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true); setStatus("Saving…");
    const r = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft: JSON.parse(text), note: note || undefined }),
    });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) { setStatus(data.issues ? `Rejected: ${data.issues[0].path} ${data.issues[0].message}` : data.error); return; }
    setStatus(`Saved as v${data.version.n}. Earlier versions are unchanged.`);
    setNote("");
    await load();
  }

  async function revise() {
    if (!instruction.trim() || busy) return;
    setBusy(true); setStatus("Claude is revising…"); setProposal(null);
    const r = await fetch(`/api/docs/${encodeURIComponent(id)}/revise`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ instruction }),
    });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) { setStatus(data.error ?? "Revise failed"); return; }
    setProposal(pretty(data.proposed));
    setStatus(`Proposal ready (${data.usage?.input_tokens ?? "?"} in · ${data.usage?.output_tokens ?? "?"} out). Review the diff.`);
  }

  async function openCompare(n: number) {
    if (compareTo === n) { setCompareTo(null); return; }
    const r = await fetch(`/api/docs/${encodeURIComponent(id)}?v=${n}`);
    if (r.ok) { setCompareText(pretty((await r.json()).draft)); setCompareTo(n); }
  }

  const diffLines = useMemo(() => {
    if (proposal) return compact(lineDiff(text, proposal));
    if (compareTo !== null) return compact(lineDiff(compareText, text));
    return null;
  }, [proposal, compareTo, compareText, text]);

  if (!doc || !family) {
    return <main style={{ minHeight: "100vh", background: C.void900, color: C.ivory100, padding: 40 }}><p style={{ color: C.ivory82 }}>{status || "Loading…"}</p></main>;
  }

  return (
    <main style={{ minHeight: "100vh", background: C.void900, color: C.ivory100, padding: "32px 28px 56px" }}>
      <style>{`
        .ed-btn:hover:not(:disabled), .ed-btn:focus-visible { outline: 2px solid ${C.ivory100}; outline-offset: 2px; }
        .ed-btn:disabled { opacity: .55; cursor: not-allowed; }
        .ed-field:focus { border-color: ${C.bronze} !important; outline: 2px solid ${C.bronze}; outline-offset: 0; }
        .ed-grid { display: grid; gap: 20px; grid-template-columns: 240px minmax(0,1fr) minmax(0,1fr); }
        @media (max-width: 1100px) { .ed-grid { grid-template-columns: 1fr; } }
      `}</style>

      <header style={{ maxWidth: 1600, margin: "0 auto 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <a href="/engine" style={{ ...eyebrow, textDecoration: "none" }}>← Engine of Artifact</a>
          <h1 style={{ fontFamily: "var(--font-forge-display), serif", fontSize: 30, lineHeight: 1.2, fontWeight: 400, margin: "8px 0 6px" }}>{doc.title}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: C.ivory70 }}>
            {[doc.family, `gen ${doc.generation}`, `v${latest}`, doc.audience].map((t) => (
              <span key={t} style={{ border: `1px solid ${t === "client-facing" ? C.bronze : C.slate600}`, color: t === "client-facing" ? C.bronze : C.ivory70, padding: "3px 8px" }}>{t}</span>
            ))}
          </div>
        </div>
        <p aria-live="polite" style={{ color: C.ivory82, fontSize: 13, margin: 0, maxWidth: 520 }}>{status}</p>
      </header>

      {doc.audience === "client-facing" && (
        <p style={{ maxWidth: 1600, margin: "0 auto 16px", background: C.void700, borderLeft: `3px solid ${C.bronze}`, padding: "10px 14px", color: C.ivory100, fontSize: 13 }}>
          Client-facing document: kept as evidence. Every save adds a new version; nothing earlier is ever changed.
        </p>
      )}

      <div className="ed-grid" style={{ maxWidth: 1600, margin: "0 auto" }}>
        {/* Versions rail */}
        <aside style={panel} aria-label="Versions">
          <div style={eyebrow}>Versions</div>
          <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}>
            {[...doc.versions].reverse().map((v) => (
              <li key={v.n} style={{ border: `1px solid ${compareTo === v.n ? C.bronze : C.slate700}`, background: C.void700, padding: "8px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: v.n === latest ? C.bronze : C.ivory100 }}>v{v.n}</span>
                  <span style={{ fontSize: 11, color: C.ivory70 }}>{v.by}</span>
                </div>
                <div style={{ fontSize: 11, color: C.ivory70, marginTop: 2 }}>{new Date(v.created).toLocaleString()}</div>
                {v.note && <div style={{ fontSize: 12, color: C.ivory82, marginTop: 4 }}>{v.note}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button className="ed-btn" style={{ ...btn(false), padding: "3px 8px", fontSize: 11 }} onClick={() => openCompare(v.n)} aria-pressed={compareTo === v.n}>
                    {compareTo === v.n ? "hide diff" : "diff"}
                  </button>
                  <button className="ed-btn" style={{ ...btn(false), padding: "3px 8px", fontSize: 11 }} onClick={() => load(v.n)}>edit from</button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {v.outputs.filter((o) => /\.(html|txt|md)$/.test(o.file)).map((o) => (
                    <a key={o.file} href={`/api/out?path=${encodeURIComponent(`${doc.id}/v${v.n}/${o.file}`)}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.ivory82 }}>
                      {o.kind}
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </aside>

        {/* Draft editor */}
        <section style={{ ...panel, display: "flex", flexDirection: "column", gap: 12 }} aria-label="Draft">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={eyebrow}>Draft {dirty ? "· unsaved" : ""}</div>
            <span style={{ fontSize: 12, color: jsonError || issues.length ? C.ember : C.ivory70 }}>
              {jsonError ? "invalid JSON" : issues.length ? `${issues.length} issue${issues.length > 1 ? "s" : ""}` : "valid"}
            </span>
          </div>
          <label htmlFor="draft" style={{ position: "absolute", left: -9999 }}>Draft JSON</label>
          <textarea
            id="draft" className="ed-field" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)}
            style={{ minHeight: 520, flex: 1, background: C.void700, color: C.ivory100, border: `1px solid ${C.slate600}`, padding: 14, fontFamily: "inherit", fontSize: 13, lineHeight: 1.55, borderRadius: 0, resize: "vertical", tabSize: 2 }}
          />
          {(jsonError || issues.length > 0) && (
            <ul role="alert" style={{ listStyle: "none", margin: 0, padding: "10px 12px", background: C.void700, borderLeft: `3px solid ${C.ember}`, display: "grid", gap: 4, fontSize: 12 }}>
              {jsonError && <li style={{ color: C.ivory100 }}>{jsonError}</li>}
              {issues.slice(0, 8).map((i, k) => <li key={k} style={{ color: C.ivory100 }}><span style={{ color: C.ember }}>{i.path}</span> {i.message}</li>)}
            </ul>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input className="ed-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Version note (optional)"
              style={{ flex: 1, background: C.void700, color: C.ivory100, border: `1px solid ${C.slate600}`, padding: "10px 12px", fontFamily: "inherit", fontSize: 13, borderRadius: 0 }} />
            <button className="ed-btn" style={btn(true)} disabled={!canSave} onClick={save}>Save v{latest + 1}</button>
            <button className="ed-btn" style={btn(false)} disabled={!dirty || busy} onClick={() => { setText(baseText); setProposal(null); }}>Reset</button>
          </div>

          <div style={{ borderTop: `1px solid ${C.slate700}`, paddingTop: 12 }}>
            <div style={eyebrow}>Revise with Claude</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input className="ed-field" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. tighten the lead to one sentence"
                onKeyDown={(e) => e.key === "Enter" && revise()}
                style={{ flex: 1, background: C.void700, color: C.ivory100, border: `1px solid ${C.slate600}`, padding: "10px 12px", fontFamily: "inherit", fontSize: 13, borderRadius: 0 }} />
              <button className="ed-btn" style={btn(true)} disabled={!instruction.trim() || busy} onClick={revise}>Propose</button>
            </div>
            {proposal && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="ed-btn" style={btn(true)} onClick={() => { setText(proposal); setProposal(null); setStatus("Proposal applied to the draft. Save to keep it."); }}>Accept into draft</button>
                <button className="ed-btn" style={btn(false)} onClick={() => setProposal(null)}>Discard</button>
              </div>
            )}
          </div>

          {diffLines && (
            <div aria-label="Diff">
              <div style={{ ...eyebrow, marginBottom: 6 }}>{proposal ? "Proposed changes" : `Diff: v${compareTo} → working draft`}</div>
              <pre style={{ margin: 0, maxHeight: 320, overflow: "auto", background: C.void900, border: `1px solid ${C.slate700}`, padding: 10, fontSize: 12, lineHeight: 1.5 }}>
                {diffLines.length === 0 ? <span style={{ color: C.ivory70 }}>No differences.</span> :
                  diffLines.map((l, k) => (
                    <div key={k} style={{ color: l.op === "+" ? C.ivory100 : l.op === "-" ? C.ivory82 : C.ivory70, background: l.op === "+" ? "#1d2a1f" : l.op === "-" ? "#2a1d1d" : "transparent", whiteSpace: "pre-wrap" }}>
                      {l.op === "…" ? "  …" : `${l.op} ${l.text}`}
                    </div>
                  ))}
              </pre>
            </div>
          )}
        </section>

        {/* Live preview */}
        <section style={{ ...panel, padding: 0, display: "flex", flexDirection: "column" }} aria-label="Live preview">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${C.slate700}` }}>
            <div style={eyebrow}>Live preview</div>
            <div role="radiogroup" aria-label="Output kind" style={{ display: "flex", gap: 4 }}>
              {family.kinds.map((k) => (
                <button key={k} role="radio" aria-checked={kind === k} className="ed-btn" onClick={() => setKind(k)}
                  style={{ ...btn(kind === k), padding: "4px 10px", fontSize: 12 }}>{k}</button>
              ))}
            </div>
          </div>
          {"error" in preview ? (
            <p style={{ margin: 16, color: C.ivory100, background: C.void700, borderLeft: `3px solid ${C.ember}`, padding: "10px 12px", fontSize: 13 }}>{preview.error}</p>
          ) : kind === "text" ? (
            <pre style={{ margin: 0, padding: 16, whiteSpace: "pre-wrap", color: C.ivory100, fontSize: 13, lineHeight: 1.55, minHeight: 600 }}>{preview.html}</pre>
          ) : (
            <iframe title="Live preview" sandbox="" srcDoc={preview.html} style={{ width: "100%", flex: 1, minHeight: 720, border: 0, background: "#ffffff" }} />
          )}
        </section>
      </div>
    </main>
  );
}
