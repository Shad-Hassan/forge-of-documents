// Port of ART/src/warden_flow.py: svg(flow, label, mode, dom_id) and email_steps(flow).
import { htmlEscape, pyFixed } from "./fmt";
import { TOKENS, WardenMode } from "./tokens";
import { Flow, FlowEdge, KIND, NODE_W, PAD, layout as _layout, FlowLane } from "./flowmode";

export const ACCENT: Record<string, string> = { start: "frost", manual: "steel", hold: "info", decision: "glacier", target: "ok" };
export const TAG: Record<string, string> = Object.fromEntries(Object.entries(KIND).map(([k, v]) => [k, v[2]]));

export function svg(flow: Flow, label: string, mode: WardenMode, domId: string): string {
  const T = TOKENS[mode];
  const nh = flow.node_h, W = flow.width, H = flow.height;
  const marker = `${domId}-arrow`;
  const out: string[] = [
    `<svg id="${domId}" class="wf-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" ` +
      `aria-label="${htmlEscape(label)}" xmlns="http://www.w3.org/2000/svg" font-family="Inter, IBM Plex Sans, Helvetica, Arial, sans-serif">`,
    `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" ` +
      `orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${T.soft}"/></marker></defs>`,
  ];
  for (const row of flow.rows) {
    out.push(
      `<text x="${W - PAD}" y="${row.header_y + 10}" text-anchor="end" font-size="13" font-weight="600" ` +
        `fill="${T.soft}">${htmlEscape(row.label)}</text>`
    );
  }
  for (const [nid, [x, y, n]] of flow.pos) {
    const [t, s] = flow.shaped.get(nid)!;
    const accent = T[ACCENT[n.kind]];
    const tag = htmlEscape(n.tag || TAG[n.kind]);
    out.push(
      `<g class="wf-node"><rect x="${x}" y="${y}" width="${NODE_W}" height="${nh}" rx="16" fill="${T.cell}" stroke="${T.rule}"/>` +
        `<rect x="${x + 14}" y="${y + 16}" width="4" height="${nh - 32}" rx="2" fill="${accent}"/>` +
        `<text x="${x + 28}" y="${y + 30}" font-size="12" font-weight="600" fill="${T.soft}">${tag}</text>`
    );
    t.forEach((line, i) => {
      out.push(`<text x="${x + 28}" y="${y + 52 + i * 21}" font-size="14" font-weight="600" fill="${T.ink}">${htmlEscape(line)}</text>`);
    });
    const base = y + 52 + t.length * 21 + 8;
    s.forEach((line, i) => {
      out.push(`<text x="${x + 28}" y="${base + 14 + i * 17}" font-size="12.5" fill="${T.soft}">${htmlEscape(line)}</text>`);
    });
    out.push("</g>");
  }
  for (const [a, b, text] of flow.edges as FlowEdge[]) {
    const [ax, ay] = flow.pos.get(a)!;
    const [bx, by] = flow.pos.get(b)!;
    let d: string;
    const nhHalf = Math.floor(nh / 2);
    if (ay === by) {
      d = `M${ax + NODE_W},${ay + nhHalf} L${bx - 2},${by + nhHalf}`;
    } else {
      const sx = ax + Math.floor(NODE_W / 2), sy = ay + nh + 2;
      const ex = bx + Math.floor(NODE_W / 2), ey = by - 2;
      const mid = Math.floor((sy + ey) / 2);
      d = `M${sx},${sy} V${mid} H${ex} V${ey}`;
    }
    out.push(
      `<path d="${d}" fill="none" stroke="${T.soft}" stroke-opacity=".8" stroke-width="1.6" marker-end="url(#${marker})"/>`
    );
    if (text && ay !== by) {
      const mid = Math.floor((sy_(ay, nh) + ey_(by)) / 2);
      const cx = (ax + bx + NODE_W) / 2;
      const lw = text.length * 7 + 18;
      out.push(
        `<rect x="${pyFixed(cx - lw / 2, 1)}" y="${mid - 24}" width="${pyFixed(lw, 1)}" height="20" rx="10" fill="${T.cell}" ` +
          `stroke="${T.rule}"/>` +
          `<text x="${pyFixed(cx, 1)}" y="${mid - 10}" text-anchor="middle" font-size="12" fill="${T.ink}">${htmlEscape(text)}</text>`
      );
    }
  }
  out.push("</svg>");
  return out.join("");
}

// helpers for the label midpoint (same arithmetic as the edge path above)
function sy_(ay: number, nh: number): number { return ay + nh + 2; }
function ey_(by: number): number { return by - 2; }

export function emailSteps(flow: Flow): [string, [string, string, string, string[]][]][] {
  const nxt = new Map<string, string[]>();
  for (const [a, b, text] of flow.edges) {
    const list = nxt.get(a) ?? [];
    list.push(text ? `${text}: ${flow.pos.get(b)![2].title}` : flow.pos.get(b)![2].title);
    nxt.set(a, list);
  }
  const lanes = new Map<number, [number, import("./flowmode").FlowNode][]>();
  for (const [, [x, y, n]] of flow.pos) {
    const list = lanes.get(y) ?? [];
    list.push([x, n]);
    lanes.set(y, list);
  }
  const laneNames = new Map(flow.rows.map((r) => [r.row_y, r.label] as [number, string]));
  const out: [string, [string, string, string, string[]][]][] = [];
  const ys = [...lanes.keys()].sort((p, q) => p - q);
  for (const y of ys) {
    const nodes = lanes.get(y)!.slice().sort((p, q) => p[0] - q[0]).map(([, n]) => n);
    out.push([
      laneNames.get(y)!,
      nodes.map((n) => [n.tag || TAG[n.kind], n.title, n.sub ?? "", nxt.get(n.id) ?? []] as [string, string, string, string[]]),
    ]);
  }
  return out;
}
