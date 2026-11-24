// Port of ART/src/flowmode.py: layout(), _node_svg(), svg(). render_png() is NOT ported (needs a headless browser).
import { htmlEscape, pyFixed, fmtF } from "./fmt";
import { pyWrap } from "./textwrap";

export interface FlowNode { id: string; kind: string; title: string; sub?: string; tag?: string }
export interface FlowLane { label: string; nodes: FlowNode[] }
export type FlowEdge = [string, string, string];

export interface Row { label: string; header_y: number; row_y: number }
export interface Flow {
  width: number;
  height: number;
  node_h: number;
  rows: Row[];
  pos: Map<string, [number, number, FlowNode]>;
  shaped: Map<string, [string[], string[]]>;
  edges: FlowEdge[];
}

export const VOID = "#0A0B0D";
export const NODE_W = 250, GAP = 40, PAD = 36, HEAD = 30, LANE_GAP = 84;
export const TITLE_WRAP = 27, SUB_WRAP = 31;

// accent bar, tag ink; [accent, ink, default tag]
export const KIND: Record<string, [string, string, string]> = {
  start: ["#9DB4CC", "#9DB4CC", "Start"],
  manual: ["#7C868E", "#9AA6B0", "Manual"],
  hold: ["#C99A3E", "#E0B46A", "On hold"],
  decision: ["#9DB4CC", "#9DB4CC", "Decision"],
  target: ["#4E9C74", "#7FC29B", "Target"],
};

export function layout(lanes: FlowLane[], edges: FlowEdge[]): Flow {
  const shaped = new Map<string, [string[], string[]]>();
  for (const lane of lanes) {
    for (const n of lane.nodes) {
      const t = pyWrap(n.title, TITLE_WRAP);
      const s = n.sub ? pyWrap(n.sub, SUB_WRAP) : [];
      shaped.set(n.id, [t, s]);
    }
  }
  let nodeH = -Infinity;
  for (const [t, s] of shaped.values()) {
    const h = 18 + 14 + 18 + t.length * 21 + (s.length ? 8 + s.length * 17 : 0) + 16;
    if (h > nodeH) nodeH = h;
  }
  const most = Math.max(...lanes.map((l) => l.nodes.length));
  const width = most * NODE_W + (most - 1) * GAP + 2 * PAD;
  const pos = new Map<string, [number, number, FlowNode]>();
  const rows: Row[] = [];
  let y = PAD;
  for (const lane of lanes) {
    const rowY = y + HEAD;
    rows.push({ label: lane.label, header_y: y + 14, row_y: rowY });
    lane.nodes.forEach((n, j) => {
      pos.set(n.id, [PAD + j * (NODE_W + GAP), rowY, n]);
    });
    y = rowY + nodeH + LANE_GAP;
  }
  const height = y - LANE_GAP + PAD;
  return { width, height, node_h: nodeH, rows, pos, shaped, edges };
}

function nodeSvg(x: number, y: number, h: number, n: FlowNode, lines: [string[], string[]]): string {
  const [accent, ink, defaultTag] = KIND[n.kind];
  const [t, s] = lines;
  const tag = htmlEscape(n.tag || defaultTag);
  const out: string[] = [
    `<g class="fm-node">`,
    `<rect x="${x}" y="${y}" width="${NODE_W}" height="${h}" rx="16" fill="url(#fmNode)" ` +
      `stroke="#E9EDF0" stroke-opacity=".14" filter="url(#fmShadow)"/>`,
    `<rect x="${x + 14}" y="${y + 16}" width="4" height="${h - 32}" rx="2" fill="${accent}"/>`,
    `<text x="${x + 28}" y="${y + 30}" font-size="12" font-weight="600" fill="${ink}">${tag}</text>`,
  ];
  t.forEach((line, i) => {
    out.push(`<text x="${x + 28}" y="${y + 52 + i * 21}" font-size="14" font-weight="600" fill="#E9EDF0">${htmlEscape(line)}</text>`);
  });
  const base = y + 52 + t.length * 21 + 8;
  s.forEach((line, i) => {
    out.push(`<text x="${x + 28}" y="${base + 14 + i * 17}" font-size="12.5" fill="#9AA6B0">${htmlEscape(line)}</text>`);
  });
  out.push("</g>");
  return out.join("");
}

export function svg(flow: Flow, domId = "flow"): string {
  const W = flow.width, H = flow.height, nh = flow.node_h;
  const parts: string[] = [
    `<svg id="${domId}" class="fm-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" ` +
      `aria-label="Flowchart: manual steps today, the on-hold API decisions, then the automated target" ` +
      `xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif">`,
    "<defs>" +
      '<linearGradient id="fmNode" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#1F262E"/><stop offset="1" stop-color="#13171C"/></linearGradient>' +
      '<filter id="fmShadow" x="-20%" y="-30%" width="140%" height="170%">' +
      '<feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#000" flood-opacity=".6"/></filter>' +
      '<marker id="fmArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="#9AA6B0"/></marker>' +
      "</defs>",
  ];
  for (const row of flow.rows) {
    parts.push(
      `<text class="fm-lane" x="${W - PAD}" y="${row.header_y + 10}" text-anchor="end" font-size="13" ` +
        `font-weight="600" fill="#9AA6B0">${htmlEscape(row.label)}</text>`
    );
  }
  for (const [nid, [x, y, n]] of flow.pos) {
    parts.push(nodeSvg(x, y, nh, n, flow.shaped.get(nid)!));
  }
  for (const [a, b, label] of flow.edges) {
    const [ax, ay] = flow.pos.get(a)!;
    const [bx, by] = flow.pos.get(b)!;
    if (ay === by) {
      const d = `M${ax + NODE_W},${ay + Math.floor(nh / 2)} L${bx - 2},${by + Math.floor(nh / 2)}`;
      parts.push(
        `<path class="fm-edge" d="${d}" fill="none" stroke="#9AA6B0" stroke-opacity=".7" ` +
          `stroke-width="1.6" marker-end="url(#fmArrow)"/>`
      );
      continue;
    }
    const sx = ax + Math.floor(NODE_W / 2), sy = ay + nh + 2;
    const ex = bx + Math.floor(NODE_W / 2), ey = by - 2;
    const mid = Math.floor((sy + ey) / 2);
    const d = `M${sx},${sy} V${mid} H${ex} V${ey}`;
    parts.push(
      `<path class="fm-edge" d="${d}" fill="none" stroke="#9AA6B0" stroke-opacity=".7" ` +
        `stroke-width="1.6" marker-end="url(#fmArrow)"/>`
    );
    if (label) {
      const lw = label.length * 6.6 + 18;
      const cx = (sx + ex) / 2;
      parts.push(
        `<rect x="${fmtF0(cx - lw / 2)}" y="${mid - 24}" width="${fmtF0(lw)}" height="20" rx="10" fill="${VOID}"/>`
      );
      parts.push(
        `<text x="${fmtF0(cx)}" y="${mid - 10}" text-anchor="middle" font-size="12" fill="#C9D1D8">${htmlEscape(label)}</text>`
      );
    }
  }
  parts.push("</svg>");
  return parts.join("");
}

/** f"{v:.1f}" */
export function fmtF0(v: number): string {
  return pyFixed(v, 1);
}
