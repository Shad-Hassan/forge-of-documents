// Athena flow diagram: geometry from lib/visuals/flowmode.ts layout(), painted in athena TOKENS.
// Every colour is paint("var(--token)") on a static string, so the output holds literal hex only.
// User text is escaped and never passes through paint().
import { layout, NODE_W, PAD, type FlowEdge, type FlowLane } from "../../visuals/flowmode";
import { esc, paint } from "./base";
import type { Block } from "./schema";

export type FlowBlock = Extract<Block, { type: "flow" }>;

// Accent bar per kind, as a token name. Accent bars are graphics, not text.
const ACCENT: Record<string, string> = { start: "primary", manual: "ink-mid", hold: "warn", decision: "primary", target: "ok" };

const c = (name: string): string => paint(`var(--${name})`);

export function flowSvg(b: FlowBlock, domId: string): string {
  const ids = new Set<string>();
  for (const lane of b.lanes) {
    for (const n of lane.nodes) {
      if (ids.has(n.id)) throw new Error(`athena flow: duplicate node id "${n.id}"`);
      ids.add(n.id);
    }
  }
  const lanes: FlowLane[] = b.lanes.map((l) => ({
    label: l.label ?? "",
    nodes: l.nodes.map((n) => ({ id: n.id, kind: n.kind, title: n.title, sub: n.sub, tag: n.tag })),
  }));
  const edges: FlowEdge[] = b.edges.map((e) => {
    if (!ids.has(e.from) || !ids.has(e.to)) throw new Error(`athena flow: edge ${e.from} -> ${e.to} names an unknown node`);
    return [e.from, e.to, e.label];
  });
  const flow = layout(lanes, edges);

  const card = c("card"), border = c("border"), inkHi = c("ink-hi"), inkMid = c("ink-mid");
  const W = flow.width, H = flow.height, nh = flow.node_h;
  const marker = `${domId}-arrow`;
  const out: string[] = [
    `<svg id="${domId}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(b.title ?? "Flow diagram")}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${inkMid}"/></marker></defs>`,
  ];
  for (const row of flow.rows) {
    if (row.label) out.push(`<text x="${W - PAD}" y="${row.header_y + 10}" text-anchor="end" font-size="13" font-weight="600" fill="${inkMid}">${esc(row.label)}</text>`);
  }
  for (const [nid, [x, y, n]] of flow.pos) {
    const [t, s] = flow.shaped.get(nid)!;
    const accent = c(ACCENT[n.kind]);
    out.push(
      `<g><rect x="${x}" y="${y}" width="${NODE_W}" height="${nh}" rx="16" fill="${card}" stroke="${border}"/>` +
        `<rect x="${x + 14}" y="${y + 16}" width="4" height="${nh - 32}" rx="2" fill="${accent}"/>` +
        (n.tag ? `<text x="${x + 28}" y="${y + 30}" font-size="12" font-weight="600" fill="${inkMid}">${esc(n.tag)}</text>` : ""),
    );
    t.forEach((line, i) => {
      out.push(`<text x="${x + 28}" y="${y + 52 + i * 21}" font-size="14" font-weight="600" fill="${inkHi}">${esc(line)}</text>`);
    });
    const base = y + 52 + t.length * 21 + 8;
    s.forEach((line, i) => {
      out.push(`<text x="${x + 28}" y="${base + 14 + i * 17}" font-size="12.5" fill="${inkMid}">${esc(line)}</text>`);
    });
    out.push("</g>");
  }
  const nhHalf = Math.floor(nh / 2);
  for (const [a, bId, text] of flow.edges as FlowEdge[]) {
    const [ax, ay] = flow.pos.get(a)!;
    const [bx, by] = flow.pos.get(bId)!;
    let d: string;
    let mid = 0;
    if (ay === by) {
      d = `M${ax + NODE_W},${ay + nhHalf} L${bx - 2},${by + nhHalf}`;
    } else {
      const sx = ax + Math.floor(NODE_W / 2), sy = ay + nh + 2;
      const ex = bx + Math.floor(NODE_W / 2), ey = by - 2;
      mid = Math.floor((sy + ey) / 2);
      d = `M${sx},${sy} V${mid} H${ex} V${ey}`;
    }
    out.push(`<path d="${d}" fill="none" stroke="${inkMid}" stroke-opacity=".8" stroke-width="1.6" marker-end="url(#${marker})"/>`);
    if (text && ay !== by) {
      const cx = (ax + bx + NODE_W) / 2;
      const lw = text.length * 7 + 18;
      out.push(
        `<rect x="${cx - lw / 2}" y="${mid - 24}" width="${lw}" height="20" rx="10" fill="${card}" stroke="${border}"/>` +
          `<text x="${cx}" y="${mid - 10}" text-anchor="middle" font-size="12" fill="${inkHi}">${esc(text)}</text>`,
      );
    }
  }
  out.push("</svg>");
  return out.join("");
}
