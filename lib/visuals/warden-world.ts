// Port of ART/src/warden_world.py: citadel(), shards(), foundation(), core_glyph(). WORLD_CSS is not ported.
import { PyRandom } from "./pyrandom";
import { fmtF, htmlEscape, pyFixed, pyFloorDiv, pyRepr, pyRound } from "./fmt";

export const W = 1600, H = 1000;
export const CX = 1000, CORE_Y = 430, FLOOR_Y = 975, POOL_Y = 900;

const SPIRE: [number, number][] = [[3, -160], [14, 120], [24, 300], [30, 380], [38, 500], [74, 512], [88, 620], [136, 632], [156, 735],
  [238, 748], [268, 850], [392, 866], [470, 1010]];
const HORNS: [number, number, number, number, number][] = [[34, 470, 100, 318, 10], [32, 410, 66, 340, 6], [70, 512, 156, 392, 14],
  [130, 632, 244, 470, 18], [232, 748, 372, 548, 22], [386, 866, 556, 626, 28]];
const FAR: [number, number, number][] = [[-60, 60, 30], [110, -40, 26], [790, 380, 14], [1530, 260, 16], [1660, 40, 28], [1840, 180, 22], [2050, -20, 30]];
const MID: [number, number, number][] = [[40, 300, 46], [1720, 250, 50]];
const STREAMS: [number, number][] = [[-260, 660], [40, 990], [330, 720], [2120, 640], [1820, 990], [1580, 700]];

type Pt = [number, number];

export function _f(v: number): string {
  return fmtF(v);
}

export function _pts(points: Pt[]): string {
  return points.map(([x, y]) => `${_f(x)},${_f(y)}`).join(" ");
}

function _outline(right: Pt[], cx: number): Pt[] {
  const pts: Pt[] = right.map(([dx, y]) => [cx + dx, y]);
  return pts.concat([...pts].reverse().map(([x, y]) => [2 * cx - x, y] as Pt));
}

function _halfWidth(y: number): number {
  for (let i = 0; i + 1 < SPIRE.length; i++) {
    const [d0, y0] = SPIRE[i];
    const [d1, y1] = SPIRE[i + 1];
    if (y0 <= y && y <= y1) return d0 + ((d1 - d0) * (y - y0)) / (y1 - y0);
  }
  return SPIRE[SPIRE.length - 1][0];
}

function _tri(rng: PyRandom, x: number, y: number, r: number): string {
  const a = rng.uniform(0, 2 * Math.PI);
  const pts: Pt[] = [];
  for (let k = 0; k < 3; k++) {
    const px = x + r * rng.uniform(0.6, 1.3) * Math.cos(a + k * 2.094 + rng.uniform(-0.5, 0.5));
    const py = y + r * rng.uniform(0.6, 1.3) * Math.sin(a + k * 2.094 + rng.uniform(-0.5, 0.5));
    pts.push([px, py]);
  }
  return "M" + pts.map(([px, py]) => `${_f(px)},${_f(py)}`).join("L") + "Z";
}

function _dia(x: number, y: number, r: number): string {
  return `M${_f(x)},${_f(y - r)}l${_f(r)},${_f(r)}l${_f(-r)},${_f(r)}l${_f(-r)},${_f(-r)}z`;
}

class _Ink {
  d = new Map<string, { token: string; opacity: number; subs: string[] }>();

  add(token: string, opacity: number, sub: string): void {
    const op = pyRound(opacity * 20) / 20;
    const key = `${token}\u0000${op}`;
    let entry = this.d.get(key);
    if (!entry) {
      entry = { token, opacity: op, subs: [] };
      this.d.set(key, entry);
    }
    entry.subs.push(sub);
  }

  svg(): string {
    const entries = [...this.d.values()].sort((p, q) =>
      p.token < q.token ? -1 : p.token > q.token ? 1 : p.opacity - q.opacity
    );
    return entries
      .map((e) => `<path fill="var(--${e.token})" opacity="${_f(e.opacity)}" d="${e.subs.join("")}"/>`)
      .join("");
  }
}

function _horn(bdx: number, by: number, tdx: number, ty: number, w: number, s: number): string {
  const bx = bdx + 0.2 * w, dx = tdx - bdx - 0.2 * w, dy = ty - by;
  const n = Math.hypot(dx, dy);
  const nx = -dy / n, ny = dx / n;
  const kx = bx + 0.55 * dx + nx * 0.07 * n, ky = by + 0.55 * dy + ny * 0.07 * n;
  const pts: Pt[] = [
    [bdx - 0.3 * w, by],
    [bdx + 0.7 * w, by],
    [kx + nx * 0.22 * w, ky + ny * 0.22 * w],
    [tdx, ty],
    [kx - nx * 0.22 * w, ky - ny * 0.22 * w],
  ];
  return "M" + pts.map(([px, py]) => _pts([[CX + s * px, py]])).join("L") + "Z";
}

function _octa(cx: number, cy: number, rx: number, ry: number, edge = 0.8): string {
  const top: Pt = [cx, cy - ry], bot: Pt = [cx, cy + ry], lef: Pt = [cx - rx, cy], rig: Pt = [cx + rx, cy];
  const fr: Pt = [cx - rx * 0.22, cy + ry * 0.12];
  const faces: [Pt[], string, number][] = [
    [[top, lef, fr], "gold", 0.95],
    [[top, fr, rig], "gold", 0.6],
    [[lef, bot, fr], "frost", 0.8],
    [[fr, bot, rig], "glacier", 0.5],
  ];
  const out = faces.map(([p, t, o]) => `<polygon points="${_pts(p)}" fill="var(--${t})" opacity="${pyRepr(o)}"/>`).join("");
  const edges: [Pt, Pt][] = [[top, lef], [lef, bot], [bot, rig], [rig, top], [top, fr], [fr, bot], [lef, fr], [fr, rig]];
  return (
    out +
    `<path fill="none" stroke="var(--glacier)" stroke-width="${pyRepr(edge)}" stroke-opacity=".8" d="` +
    edges.map(([a, b]) => `M${_pts([a])}L${_pts([b])}`).join("") +
    '"/>'
  );
}

const DEFS = `<defs>
<radialGradient id="ic-sky"><stop offset="0" stop-color="var(--frost)" stop-opacity=".36"/><stop offset=".5" stop-color="var(--frost)" stop-opacity=".09"/><stop offset="1" stop-color="var(--frost)" stop-opacity="0"/></radialGradient>
<radialGradient id="ic-heat"><stop offset="0" stop-color="var(--ember)" stop-opacity=".16"/><stop offset=".6" stop-color="var(--ember)" stop-opacity=".04"/><stop offset="1" stop-color="var(--ember)" stop-opacity="0"/></radialGradient>
<radialGradient id="ic-throne"><stop offset="0" stop-color="var(--gold)" stop-opacity=".42"/><stop offset=".45" stop-color="var(--gold)" stop-opacity=".1"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></radialGradient>
<linearGradient id="ic-haze" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="var(--frost)" stop-opacity="0"/><stop offset=".88" stop-color="var(--frost)" stop-opacity=".07"/><stop offset="1" stop-color="var(--frost)" stop-opacity=".03"/></linearGradient>
<linearGradient id="ic-light" gradientUnits="userSpaceOnUse" x1="0" y1="-160" x2="0" y2="700"><stop offset="0" stop-color="var(--frost)" stop-opacity=".34"/><stop offset="1" stop-color="var(--frost)" stop-opacity="0"/></linearGradient>
<linearGradient id="ic-rim" gradientUnits="userSpaceOnUse" x1="0" y1="-160" x2="0" y2="980"><stop offset="0" stop-color="var(--glacier)" stop-opacity=".75"/><stop offset=".55" stop-color="var(--glacier)" stop-opacity=".22"/><stop offset="1" stop-color="var(--glacier)" stop-opacity="0"/></linearGradient>
<linearGradient id="ic-conduit" gradientUnits="userSpaceOnUse" x1="0" y1="-160" x2="0" y2="${FLOOR_Y}"><stop offset="0" stop-color="var(--frost)"/><stop offset=".4" stop-color="var(--glacier)"/><stop offset="${pyFixed((CORE_Y + 160) / (FLOOR_Y + 160), 3)}" stop-color="var(--gold)"/><stop offset=".82" stop-color="var(--ember-lit)"/><stop offset="1" stop-color="var(--ember)" stop-opacity="0"/></linearGradient>
<linearGradient id="ic-stream" gradientUnits="userSpaceOnUse" x1="0" y1="560" x2="0" y2="${FLOOR_Y}"><stop offset="0" stop-color="var(--gold)" stop-opacity="0"/><stop offset=".3" stop-color="var(--gold)"/><stop offset=".75" stop-color="var(--ember-lit)"/><stop offset="1" stop-color="var(--ember)" stop-opacity="0"/></linearGradient>
<radialGradient id="ic-pool"><stop offset="0" stop-color="var(--ember-lit)" stop-opacity=".55"/><stop offset=".5" stop-color="var(--gold)" stop-opacity=".15"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></radialGradient>
<linearGradient id="ic-drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--night-ink)" stop-opacity="0"/><stop offset=".7" stop-color="var(--night-ink)" stop-opacity=".95"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></linearGradient>
<linearGradient id="ic-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--paper)" stop-opacity="0"/><stop offset="1" stop-color="var(--paper)"/></linearGradient>
</defs>`;

let SCENE: string | null = null;

function scene(): string {
  const rng = new PyRandom(1219);
  const out: string[] = [
    DEFS,
    `<rect x="-600" y="-200" width="${W + 1200}" height="${H + 400}" fill="var(--void)"/>`,
    `<ellipse cx="${CX}" cy="-120" rx="1050" ry="900" fill="url(#ic-sky)"/>`,
    `<ellipse cx="${CX}" cy="1060" rx="1150" ry="380" fill="url(#ic-heat)"/>`,
  ];

  const stars = new _Ink();
  for (let i = 0; i < 170; i++) {
    const tok = "night-ink";
    const op = rng.uniform(0.12, 0.65);
    const x = rng.uniform(-300, 1900);
    const y = 640 * Math.pow(rng.random(), 1.5);
    const r = rng.uniform(0.5, 1.4);
    stars.add(tok, op, _dia(x, y, r));
  }
  out.push(stars.svg());

  for (const [x, tip, hb] of FAR) {
    const right: Pt[] = [[2, tip], [hb * 0.35, tip + (1000 - tip) * 0.45], [hb * 0.6, tip + (1000 - tip) * 0.47], [hb, 1010]];
    out.push(`<polygon points="${_pts(_outline(right, x))}" fill="var(--saronite-far)"/>`);
  }
  let band: Pt[] = [[-600, 1010]];
  let x = -600;
  while (x < 2400) {
    const y = rng.uniform(780, 900);
    const x1 = x;
    band.push([x1, y]);
    const x2 = x1 + rng.uniform(60, 140);
    band.push([x2, y]);
    x = band[band.length - 1][0];
  }
  band.push([x, 1010]);
  out.push(`<polygon points="${_pts(band)}" fill="var(--saronite-far)"/>`);
  out.push(`<rect x="-600" y="0" width="${W + 1200}" height="${H}" fill="url(#ic-haze)"/>`);
  for (const [xm, tip, hb] of MID) {
    const right: Pt[] = [[2, tip], [hb * 0.3, tip + (1000 - tip) * 0.4], [hb * 0.55, tip + (1000 - tip) * 0.42], [hb, 1010]];
    out.push(`<polygon points="${_pts(_outline(right, xm))}" fill="var(--saronite-mid)"/>`);
  }

  const chaos = new _Ink();
  for (let i = 0; i < 110; i++) {
    const token = rng.choiceWeighted(["steel", "neutral", "glacier", "ember"], [45, 30, 17, 8]);
    const op = token === "ember" ? rng.uniform(0.3, 0.5) : rng.uniform(0.12, 0.42);
    const tx = rng.uniform(-300, 1900);
    const ty = 640 + 350 * Math.pow(rng.random(), 0.7);
    const tr = rng.uniform(1.5, 6);
    chaos.add(token, op, _tri(rng, tx, ty, tr));
  }
  out.push(chaos.svg());

  const spire = _pts(_outline(SPIRE, CX));
  const horns = HORNS.flatMap((h) => [1, -1].map((s) => _horn(h[0], h[1], h[2], h[3], h[4], s))).join("");
  out.push(
    `<polygon points="${spire}" fill="var(--saronite)"/><path d="${horns}" fill="var(--saronite)"/>` +
      `<polygon points="${spire}" fill="url(#ic-light)"/>` +
      `<polygon points="${spire}" fill="none" stroke="url(#ic-rim)" stroke-width="1.2"/>` +
      `<path d="${horns}" fill="none" stroke="url(#ic-rim)" stroke-width="1"/>`
  );
  let ribs = "";
  for (let dx = 18; dx < 400; dx += 18) {
    for (const s of [1, -1]) {
      let y0 = -1;
      for (let y = -160; y < 1010; y += 4) {
        if (_halfWidth(y) > dx + 8) {
          y0 = y;
          break;
        }
      }
      ribs += `M${CX + s * dx},${y0}V1000`;
    }
  }
  out.push(`<path d="${ribs}" stroke="var(--steel)" stroke-opacity=".06" stroke-width=".8"/>`);

  const lights = new _Ink();
  for (let y = 150; y < 900; y += 24) {
    const slots = Math.trunc(pyFloorDiv(_halfWidth(y) - 7, 12));
    const picks = slots > 0 ? rng.sampleRange(-slots, slots + 1, Math.min(8, 2 * slots + 1)) : [];
    for (const k of picks) {
      const gold = Math.abs(y - CORE_Y) < 110 && rng.random() < 0.5;
      const op = rng.uniform(0.2, 0.75);
      lights.add(gold ? "gold" : "glacier", op, `M${_f(CX + 12 * k - 0.8)},${y}h1.6v6h-1.6z`);
    }
  }
  out.push(lights.svg());

  const cage: Pt[] = [[CX, CORE_Y - 118], [CX + 66, CORE_Y], [CX, CORE_Y + 118], [CX - 66, CORE_Y]];
  const inner: Pt[] = [[CX, CORE_Y - 40], [CX + 24, CORE_Y], [CX, CORE_Y + 40], [CX - 24, CORE_Y]];
  let spoke = "";
  cage.forEach((a, i) => {
    spoke += `M${_pts([a])}L${_pts([inner[i]])}`;
  });
  out.push(
    `<ellipse cx="${CX}" cy="${CORE_Y}" rx="200" ry="250" fill="url(#ic-throne)"/>` +
      `<polygon points="${_pts(cage)}" fill="none" stroke="var(--frost)" stroke-opacity=".34" stroke-width=".8"/>` +
      `<path stroke="var(--frost)" stroke-opacity=".2" stroke-width=".7" d="${spoke}"/>` +
      `<line x1="${CX}" y1="-160" x2="${CX}" y2="${FLOOR_Y}" stroke="url(#ic-conduit)" stroke-width="9" stroke-opacity=".14"/>` +
      `<line x1="${CX}" y1="-160" x2="${CX}" y2="${FLOOR_Y}" stroke="url(#ic-conduit)" stroke-width="1.6"/>` +
      _octa(CX, CORE_Y, 24, 40)
  );

  const flow = new _Ink();
  for (const [ox, oy] of STREAMS) {
    const dx = CX - ox, dy = POOL_Y - oy;
    const n = Math.hypot(dx, dy);
    const px = -dy / n, py = dx / n;
    for (let i = 0; i < 28; i++) {
      const t = i / 27;
      const e = Math.pow(t, 0.85);
      const amp = 54 * Math.pow(1 - t, 1.7);
      const off = rng.gauss(0, amp);
      const along = rng.gauss(0, amp * 0.5);
      const x = ox + dx * e + px * off + (dx / n) * along;
      const y = oy + dy * e + py * off + (dy / n) * along;
      if (t < 0.5) {
        const tok = rng.choice(["steel", "neutral"]);
        const op = 0.22 + 0.6 * t;
        flow.add(tok, op, _tri(rng, x, y, 4.5 * (1 - t) + 1.2));
      } else {
        flow.add(t < 0.86 ? "glacier" : "gold", 0.22 + 0.6 * t, _dia(x, y, 1.7));
      }
    }
  }
  out.push(flow.svg());

  const walls: Pt[][] = [
    [[-600, 1010], [-600, 700], [-120, 700], [-120, 760], [60, 760], [60, 820], [220, 820], [220, 880],
      [380, 880], [380, 940], [560, 940], [560, 1010]],
    [[2300, 1010], [2300, 720], [1820, 720], [1820, 780], [1680, 780], [1680, 850], [1560, 850],
      [1560, 920], [1460, 920], [1460, 1010]],
  ];
  for (const wall of walls) {
    out.push(`<polygon points="${_pts(wall)}" fill="var(--paper)" stroke="var(--steel)" stroke-opacity=".28" stroke-width="1"/>`);
  }
  out.push(`<rect x="-600" y="880" width="${W + 1200}" height="130" fill="url(#ic-floor)"/>`);

  out.push(
    `<g class="stream"><ellipse cx="${CX}" cy="${FLOOR_Y - 22}" rx="90" ry="16" fill="url(#ic-pool)"/>` +
      `<line x1="${CX}" y1="560" x2="${CX}" y2="${FLOOR_Y}" stroke="url(#ic-stream)" stroke-width="18" stroke-opacity=".2" stroke-linecap="round"/>` +
      `<line x1="${CX}" y1="560" x2="${CX}" y2="${FLOOR_Y}" stroke="url(#ic-stream)" stroke-width="2.6" stroke-linecap="round"/></g>` +
      `<rect class="drop" x="${pyRepr(CX - 1.6)}" y="560" width="3.2" height="80" rx="1.6" fill="url(#ic-drop)"/>`
  );
  return out.join("");
}

function sceneOnce(): string {
  if (SCENE === null) SCENE = scene();
  return SCENE;
}

export function citadel(): string {
  return (
    `<svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" ` +
    `focusable="false">${sceneOnce()}</svg>`
  );
}

export function shards(seed = 7, n = 46): string {
  const rng = new PyRandom(seed);
  const ink = new _Ink();
  for (let i = 0; i < n; i++) {
    const tok = rng.choice(["steel", "steel", "neutral", "glacier"]);
    const op = rng.uniform(0.18, 0.55);
    const tx = 480 * Math.pow(rng.random(), 0.6);
    const ty = rng.uniform(8, 142);
    const tr = rng.uniform(2, 7);
    ink.add(tok, op, _tri(rng, tx, ty, tr));
  }
  return `<svg class="shards" viewBox="0 0 480 150" aria-hidden="true" focusable="false">${ink.svg()}</svg>`;
}

export function foundation(): string {
  const cx = 800;
  const right: Pt[] = [];
  let prev = 0;
  for (const [dx, depth] of [[1400, 8], [560, 18], [380, 30], [240, 42], [130, 54], [56, 64], [0, 70]] as Pt[]) {
    right.push([cx + dx, prev], [cx + dx, depth]);
    prev = depth;
  }
  const pts = right.concat([...right].reverse().map(([x, y]) => [2 * cx - x, y] as Pt));
  return (
    `<svg class="foundation" viewBox="0 0 1600 72" preserveAspectRatio="xMidYMin slice" aria-hidden="true" ` +
    `focusable="false"><polygon points="${_pts(pts)}" fill="var(--paper)" stroke="var(--steel)" ` +
    `stroke-opacity=".3" stroke-width="1"/></svg>`
  );
}

export function coreGlyph(): string {
  return `<svg class="core-glyph" viewBox="0 0 24 34" aria-hidden="true" focusable="false">${_octa(12, 17, 10, 15, 0.6)}</svg>`;
}

export { htmlEscape, pyFloorDiv };
