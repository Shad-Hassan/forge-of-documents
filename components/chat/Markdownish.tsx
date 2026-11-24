// Light Markdown → React elements (no innerHTML): paragraphs, #/##/### headings, - / 1. lists,
// **bold**, `code`, and | tables |. Anything else renders as plain text.
import React from "react";

const C = { ivory100: "#f5f1e8", ivory82: "#d1cac0", bronze: "#a67c52", void700: "#11151f", slate700: "#334155" };

function inline(s: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    out.push(
      t.startsWith("**")
        ? <strong key={`${key}-${i++}`} style={{ color: C.ivory100, fontWeight: 700 }}>{t.slice(2, -2)}</strong>
        : <code key={`${key}-${i++}`} style={{ background: C.void700, border: `1px solid ${C.slate700}`, padding: "1px 5px", fontSize: "0.92em" }}>{t.slice(1, -1)}</code>,
    );
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export default function Markdownish({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const size = [20, 17, 15][h[1].length - 1];
      blocks.push(<p key={k++} style={{ fontSize: size, fontWeight: 700, color: C.ivory100, margin: "18px 0 8px" }}>{inline(h[2], `h${k}`)}</p>);
      i++; continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={k++} style={{ overflowX: "auto", margin: "10px 0" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 14, minWidth: "60%" }}>
            <thead><tr>{head.map((c, j) => <th key={j} style={{ textAlign: "left", padding: "6px 12px 6px 0", borderBottom: `1px solid ${C.slate700}`, color: C.ivory82, fontWeight: 600 }}>{inline(c, `th${k}${j}`)}</th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} style={{ padding: "6px 12px 6px 0", borderBottom: `1px solid ${C.slate700}`, color: C.ivory100 }}>{inline(c, `td${k}${ri}${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    const ul = /^\s*[-*•]\s+/, ol = /^\s*\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? ol : ul).test(lines[i])) items.push(lines[i++].replace(ordered ? ol : ul, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(<Tag key={k++} style={{ margin: "8px 0", paddingLeft: 22, display: "grid", gap: 4 }}>{items.map((it, j) => <li key={j}>{inline(it, `li${k}${j}`)}</li>)}</Tag>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s|^\s*[-*•]\s|^\s*\d+[.)]\s|^\s*\|/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++} style={{ margin: "8px 0" }}>{para.flatMap((p, j) => (j ? [<br key={`br${j}`} />, ...inline(p, `p${k}${j}`)] : inline(p, `p${k}${j}`)))}</p>);
  }
  return <>{blocks}</>;
}
