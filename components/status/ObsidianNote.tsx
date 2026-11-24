// Renders an Obsidian-flavoured Markdown note as React elements (server component, no innerHTML):
// YAML frontmatter → Properties panel · # headings · > [!type] callouts (nested blocks) · - [x] tasks ·
// tables · lists · **bold**, `code`, [[wikilinks]]. Contrast of every text colour computed ≥ 4.5:1.
import React from "react";

const C = {
  void900: "#0b0f1a", void800: "#0d1117", void700: "#11151f",
  ivory100: "#f5f1e8", ivory82: "#d1cac0", ivory70: "#bab1a8",
  bronze: "#a67c52", slate700: "#334155", slate600: "#475569",
};
const CALLOUT: Record<string, { color: string; icon: string; label: string }> = {
  summary: { color: C.bronze, icon: "◆", label: "Summary" },
  info: { color: C.bronze, icon: "ℹ", label: "Info" },
  success: { color: "#4ade80", icon: "✓", label: "Success" },
  warning: { color: "#ea580c", icon: "!", label: "Warning" },
  todo: { color: "#c4b5fd", icon: "○", label: "To do" },
  important: { color: "#ea580c", icon: "★", label: "Important" },
};

export function parseFrontmatter(src: string): { props: Array<[string, string]>; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { props: [], body: src };
  const props: Array<[string, string]> = [];
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) props.push([kv[1], kv[2].replace(/^\[(.*)\]$/, "$1")]);
  }
  return { props, body: src.slice(m[0].length) };
}

function inline(s: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0], k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k} style={{ color: C.ivory100 }}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} style={{ background: C.void700, border: `1px solid ${C.slate700}`, padding: "1px 5px", fontSize: "0.9em", color: C.ivory100 }}>{t.slice(1, -1)}</code>);
    else out.push(<span key={k} style={{ color: C.bronze, borderBottom: `1px dotted ${C.bronze}` }}>{t.slice(2, -2)}</span>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function Table({ rows, k }: { rows: string[][]; k: string }) {
  const [head, ...body] = rows;
  return (
    <div style={{ overflowX: "auto", margin: "10px 0 14px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
        <thead><tr>{head.map((c, j) => <th key={j} style={{ textAlign: "left", padding: "7px 12px", borderBottom: `1px solid ${C.slate600}`, color: C.ivory82, fontWeight: 600, background: C.void800 }}>{inline(c, `${k}h${j}`)}</th>)}</tr></thead>
        <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} style={{ padding: "7px 12px", borderBottom: `1px solid ${C.slate700}`, color: C.ivory100, verticalAlign: "top" }}>{inline(c, `${k}${ri}${j}`)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Blocks({ src, depth = 0 }: { src: string; depth?: number }) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0, k = 0;
  const key = () => `${depth}-${k++}`;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith(">")) {
      const inner: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) inner.push(lines[i++].replace(/^>\s?/, ""));
      const head = inner[0]?.match(/^\[!(\w+)\]\s*(.*)$/);
      if (head) {
        const style = CALLOUT[head[1].toLowerCase()] ?? CALLOUT.info;
        out.push(
          <aside key={key()} style={{ margin: "14px 0", background: C.void700, borderLeft: `3px solid ${style.color}`, padding: "12px 16px" }}>
            <div style={{ color: style.color, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{style.icon} {head[2] || style.label}</div>
            <div style={{ color: C.ivory100 }}><Blocks src={inner.slice(1).join("\n")} depth={depth + 1} /></div>
          </aside>,
        );
      } else {
        out.push(<blockquote key={key()} style={{ margin: "10px 0", paddingLeft: 12, borderLeft: `2px solid ${C.slate600}`, color: C.ivory82 }}><Blocks src={inner.join("\n")} depth={depth + 1} /></blockquote>);
      }
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const style: React.CSSProperties =
        lvl === 1 ? { fontFamily: "var(--font-forge-display), serif", fontSize: 34, fontWeight: 400, margin: "6px 0 14px", color: C.ivory100 }
        : lvl === 2 ? { fontSize: 20, fontWeight: 700, margin: "30px 0 10px", color: C.ivory100, paddingBottom: 6, borderBottom: `1px solid ${C.slate700}` }
        : { fontSize: 16, fontWeight: 700, margin: "18px 0 8px", color: C.ivory100 };
      const Tag = (`h${lvl}` as "h1" | "h2" | "h3");
      out.push(<Tag key={key()} style={style}>{inline(h[2], key())}</Tag>);
      i++; continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      out.push(<Table key={key()} rows={rows} k={key()} />);
      continue;
    }

    const task = /^\s*-\s+\[( |x)\]\s+/i, ul = /^\s*[-*]\s+/, ol = /^\s*\d+[.)]\s+/;
    if (task.test(line)) {
      const items: Array<[boolean, string]> = [];
      while (i < lines.length && task.test(lines[i])) {
        const m = lines[i].match(task)!;
        items.push([m[1].toLowerCase() === "x", lines[i].replace(task, "")]);
        i++;
      }
      out.push(
        <ul key={key()} style={{ listStyle: "none", padding: 0, margin: "8px 0", display: "grid", gap: 5 }}>
          {items.map(([done, t], j) => (
            <li key={j} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span aria-label={done ? "done" : "open"} style={{ width: 16, height: 16, flexShrink: 0, border: `1px solid ${done ? C.bronze : C.slate600}`, background: done ? C.bronze : "transparent", color: C.void900, fontSize: 11, lineHeight: "15px", textAlign: "center", fontWeight: 700 }}>{done ? "✓" : ""}</span>
              <span style={{ color: C.ivory100 }}>{inline(t, `${key()}${j}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? ol : ul).test(lines[i]) && !task.test(lines[i])) items.push(lines[i++].replace(ordered ? ol : ul, ""));
      const Tag = ordered ? "ol" : "ul";
      out.push(<Tag key={key()} style={{ margin: "8px 0", paddingLeft: 22, display: "grid", gap: 5, color: C.ivory100 }}>{items.map((t, j) => <li key={j}>{inline(t, `${key()}${j}`)}</li>)}</Tag>);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\s*[-*]\s|\s*\d+[.)]\s|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={key()} style={{ margin: "8px 0", color: C.ivory100 }}>{inline(para.join(" "), key())}</p>);
  }
  return <>{out}</>;
}

export function Properties({ props, live }: { props: Array<[string, string]>; live: Array<[string, string]> }) {
  const all = [...props.filter(([k]) => k !== "title"), ...live];
  return (
    <section aria-label="Properties" style={{ background: C.void800, border: `1px solid ${C.slate700}`, padding: "10px 14px", margin: "0 0 22px" }}>
      <div style={{ color: C.ivory70, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Properties</div>
      <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 5, columnGap: 12, margin: 0, fontSize: 13 }}>
        {all.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt style={{ color: C.ivory70 }}>{k}</dt>
            <dd style={{ margin: 0, color: C.ivory100, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {k === "tags" || k === "aliases"
                ? v.split(",").map((t) => <span key={t} style={{ border: `1px solid ${C.bronze}`, color: C.bronze, padding: "0 7px", fontSize: 12 }}>{k === "tags" ? "#" : ""}{t.trim()}</span>)
                : v}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  );
}
