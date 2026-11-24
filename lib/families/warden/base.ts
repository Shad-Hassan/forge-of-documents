// Port of warden_base.py (tokens, CSS, fonts, ROMAN, paint, skyline, contrast, check).
// Pure: no I/O. write() from the Python source is not ported (file output belongs to the caller).

export type Mode = "cosmic" | "print";

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">';

const FONTS_COSMIC =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&family=JetBrains+Mono:wght@500&display=swap">';

export function fonts(mode: Mode): string {
  return mode === "cosmic" ? FONTS_COSMIC : FONTS;
}

export function chainUrl(color: string): string {
  const c = color.replace(/#/g, "%23");
  return (
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='28' viewBox='0 0 12 28'%3E` +
    `%3Crect x='2' y='1' width='8' height='14' rx='4' fill='none' stroke='${c}' stroke-width='2'/%3E` +
    `%3Crect x='5' y='13' width='2' height='15' rx='1' fill='${c}'/%3E%3C/svg%3E")`
  );
}

const PLEX = '"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
const INTER = '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';

export const TOKENS: Record<Mode, Record<string, string>> = {
  print: {
    scheme: "light",
    paper: "#EEF1F4", cell: "#FAFCFD", ice: "#D3DEE7", rime: "#E4EDF3",
    night: "#0A1119", "night-ink": "#E8F0F6", "night-soft": "#8DA3B6", "night-line": "#1E2B39", "night-cell": "#131D29",
    ink: "#141A21", soft: "#46525E", muted: "#6F7C88", hair: "#DDE4EA", rule: "#C6D1DA",
    frost: "#2C6488", glacier: "#8DB8D3", steel: "#5E7A96", neutral: "#C3C9CE",
    ember: "#A2472A", "ember-bg": "#F6E6DE", "ember-lit": "#E09A7E",
    ok: "#2F6B4F", "ok-bg": "#E3EFE6", info: "#8A6414", "info-bg": "#F6EDD6", risk: "#9A4A3A", "risk-bg": "#F3E3DE",
    void: "#0A1119", saronite: "#131D29", "saronite-mid": "#18222F", "saronite-far": "#1E2B39", gold: "#8A6414",
    sans: PLEX,
    cond: '"IBM Plex Sans Condensed","IBM Plex Sans",Helvetica,Arial,sans-serif',
    mono: PLEX,
    "kicker-font": PLEX,
    "throne-bg": "radial-gradient(ellipse 70% 70% at 50% 100%,rgba(159,196,221,.16),transparent 70%),#0A1119",
    "chain-link": chainUrl("#C6D1DA"),
    glass: "rgba(250,252,253,.72)", "glass-line": "rgba(198,209,218,.7)",
  },
  cosmic: {
    scheme: "dark",
    paper: "#090A0C", cell: "#111317", ice: "#1F2228", rime: "#16181C",
    night: "#060708", "night-ink": "#F5F5F5", "night-soft": "#9CA3AF", "night-line": "#1C1F24", "night-cell": "#0F1115",
    ink: "#F5F5F5", soft: "#B0B6BF", muted: "#8A919C", hair: "#1C1F24", rule: "#2A2E35",
    frost: "#5683DA", glacier: "#8FB0F0", steel: "#6E86B0", neutral: "#3A3F47",
    ember: "#FF7A33", "ember-bg": "#1E140E", "ember-lit": "#FFA372",
    ok: "#4FBF8A", "ok-bg": "#10231A", info: "#E3B45A", "info-bg": "#241D0E", risk: "#FF8A70", "risk-bg": "#2A1512",
    // Cosmic Icecrown world (warden_world.py): sky, saronite in three depths, gold threshold light.
    void: "#030405", saronite: "#0A0C10", "saronite-mid": "#0F1218", "saronite-far": "#161B24", gold: "#E2B866",
    sans: INTER,
    cond: '"Inter Tight","Inter",Helvetica,Arial,sans-serif',
    mono: '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace',
    "kicker-font": '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace',
    "throne-bg":
      "radial-gradient(ellipse 60% 85% at 50% 100%,rgba(86,131,218,.34) 0%," +
      "rgba(255,179,107,.10) 45%,transparent 72%),#060708",
    "chain-link": chainUrl("#2A2E35"),
    glass: "rgba(17,19,23,.55)", "glass-line": "rgba(255,255,255,.14)",
  },
};

// The PDF renders on the print paper token (frost), never white.
const PDF_PAPER: Record<string, string> = { paper: "#EEF1F4" };

const CSS_SRC = `
:root{color-scheme:var(--scheme)}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 var(--sans);-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.wrap{max-width:1080px;margin:0 auto;padding-inline:32px}
h1,h2,h3{text-wrap:balance}

.throne{background:var(--throne-bg);color:var(--night-ink);padding-top:88px}
.throne .wrap{padding-bottom:40px}
.kicker{margin:0;font-family:var(--kicker-font);font-size:15px;font-weight:500;color:var(--night-soft)}
h1{font:700 clamp(46px,8vw,100px)/.95 var(--cond);letter-spacing:-.03em;margin:16px 0 24px;max-width:14ch}
.lede{margin:0;font-size:21px;line-height:1.5;color:var(--night-soft);max-width:52ch}
.facts{display:grid;grid-template-columns:repeat(4,auto);justify-content:start;gap:16px 56px;margin:44px 0 0;padding-top:24px;border-top:1px solid var(--night-line)}
.facts div{margin:0}
.facts dt{font:700 40px/1 var(--cond);letter-spacing:-.02em;color:var(--night-ink)}
.facts dd{margin:6px 0 0;font-size:14px;color:var(--night-soft)}
.skyline{display:block;width:100%;height:clamp(64px,10vw,136px)}
.sky-back{fill:var(--night-line)}
.sky-front{fill:var(--paper)}

.block{padding-top:72px}
.block.first{padding-top:40px}
.greet{margin:0 0 24px;font-size:19px;color:var(--soft);max-width:60ch}
h2{font-weight:700;font-size:clamp(30px,4vw,44px);letter-spacing:-.03em;line-height:1.05;margin:0 0 10px}
.intro{margin:0 0 32px;font-size:19px;color:var(--soft);max-width:56ch}

.verdict{background:var(--cell);border:1px solid var(--ice);border-top:2px solid var(--frost);border-radius:16px;padding:36px 40px}
.verdict .label{margin:0 0 10px;font-size:14px;font-weight:600;color:var(--frost)}
.verdict p.say{margin:0;font-weight:600;font-size:clamp(23px,3vw,31px);line-height:1.28;letter-spacing:-.02em;max-width:40ch;text-wrap:balance}

.chain{position:relative;display:grid;gap:20px;padding-left:56px}
.chain::before{content:"";position:absolute;left:18px;top:40px;bottom:40px;width:12px;background:var(--chain-link) repeat-y}
.cell{position:relative;background:var(--cell);border:1px solid var(--ice);border-radius:16px;padding:30px 36px}
.cell::before{content:"";position:absolute;top:30px;left:-44px;width:24px;height:24px;border-radius:50%;background:var(--paper);border:3px solid var(--frost)}
.cell::after{content:"";position:absolute;top:41px;left:-20px;width:20px;height:2px;background:var(--frost)}
.cell-head{display:flex;align-items:baseline;gap:18px}
.cell-no{font:700 44px/1 var(--cond);letter-spacing:-.03em;color:var(--frost);flex:none}
.cell h3{margin:0;font-size:22px;font-weight:600;letter-spacing:-.015em;line-height:1.3}
.raw{margin:20px 0 0;padding:12px 18px;background:var(--rime);border-left:2px solid var(--ember);border-radius:0 10px 10px 0;max-width:62ch}
.raw .tag{display:block;font-size:13px;font-weight:600;color:var(--ember);margin-bottom:2px}
.raw q{color:var(--soft);quotes:"\\201C" "\\201D"}
.cell .body{margin:18px 0 0;max-width:62ch}
.fronts{margin:18px 0 0;display:grid;gap:12px;max-width:66ch}
.fronts div{display:grid;grid-template-columns:190px 1fr;gap:4px 20px}
.fronts dt{font-weight:600}
.fronts dd{margin:0;color:var(--soft)}
.split{display:grid;grid-template-columns:1fr 1.5fr;gap:14px;margin-top:20px}
.split section{background:var(--paper);border-radius:12px;padding:14px 20px 10px}
.split h4{margin:0 0 4px;font-size:14px;font-weight:600;color:var(--frost)}
.split ul{margin:0;padding:0;list-style:none}
.split li{padding:7px 0;border-top:1px solid var(--hair);font-size:16px;line-height:1.45}
.split li:first-child{border-top:0}
.example{margin:16px 0 0;font-size:16px;color:var(--soft);max-width:62ch}
.bind{margin:22px 0 0;padding-top:16px;border-top:1px solid var(--hair);color:var(--soft);font-weight:500}

.tile{background:var(--cell);border:1px solid var(--ice);border-radius:16px}
.throne.ceiled{padding-top:0}
.throne .ceiling{background:var(--night-cell)}
.throne .ceiling .wrap{padding-block:18px 10px}
.ceil-links{display:grid;gap:6px;margin:0}
.ceil-links div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:14px;align-items:baseline}
.ceil-links dt{font-size:12.5px;font-weight:600;color:var(--night-soft)}
.ceil-links dd{margin:0;font-size:15px;color:var(--night-ink);overflow-wrap:anywhere}
.ceil-links a{color:var(--glacier);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}
.ceil-links a:focus-visible{outline:2px solid var(--glacier);outline-offset:2px;border-radius:2px}
.skyline.ceiling-edge{height:clamp(20px,3vw,34px);transform:scaleY(-1)}
.ceiling-edge .sky-front{fill:var(--night-cell)}
.throne.ceiled .ceiling-edge + .wrap{padding-top:30px}
.laws{list-style:none;margin:0;padding:8px 36px}
.laws li{display:grid;grid-template-columns:64px 1fr;gap:0 16px;padding:20px 0;border-bottom:1px solid var(--hair)}
.laws li:last-child{border-bottom:0}
.laws .num{font:700 30px/1.1 var(--cond);color:var(--frost)}
.laws .law{margin:0;font-weight:600;font-size:19px;line-height:1.35}
.laws .why{margin:4px 0 0;font-size:16px;color:var(--soft)}

.loose{list-style:none;margin:0;padding:8px 36px}
.loose li{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 16px;padding:18px 0;border-bottom:1px solid var(--hair)}
.loose li:last-child{border-bottom:0}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:600;white-space:nowrap}
.pill.info{background:var(--info-bg);color:var(--info)}
.pill .g{font-weight:700}

.sealed{margin-top:88px;background:var(--night);color:var(--night-soft)}
.sealed .skyline{height:clamp(32px,4vw,48px);transform:scaleY(-1)}
.sealed .wrap{padding-block:40px 64px}
.sealed .label{margin:0 0 8px;font-size:14px;font-weight:600;color:var(--glacier)}
.sealed p.who{margin:0;font-size:19px;color:var(--night-ink);max-width:56ch}
.sealed .raw{background:var(--night-cell)}
.sealed .raw .tag{color:var(--ember-lit)}
.sealed .raw q{color:var(--night-ink)}
.sealed p.ver{margin:14px 0 0;font-size:14px}

@media screen and (max-width:760px){
  .chain{padding-left:36px}
  .chain::before{left:6px}
  .cell::before{left:-36px}
  .cell::after{left:-12px;width:12px}
  .wrap{padding-inline:18px}
  .throne{padding-top:56px}
  .lede{font-size:18px}
  .facts{grid-template-columns:repeat(3,auto);gap:20px 28px}
  .facts dt{font-size:34px}
  .verdict{padding:26px 22px}
  .cell{padding:22px 20px}
  .cell-head{flex-direction:column;gap:6px}
  .split{grid-template-columns:1fr}
  .fronts div{grid-template-columns:1fr}
  .laws,.loose{padding:4px 20px}
  .laws li{grid-template-columns:40px 1fr}
  .greet,.intro{font-size:17px}
  .ceil-links{gap:10px}
  .ceil-links div{grid-template-columns:minmax(0,1fr);gap:1px}
  .ceil-links dd{font-size:14px}
}

@page{size:A4;margin:14mm 12mm}
@media print{
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{background:var(--paper);font-size:12.5px}
  .wrap{max-width:none;padding-inline:0}
  .throne{border-radius:16px;overflow:hidden;padding-top:36px}
  .throne .wrap{padding-inline:32px;padding-bottom:20px}
  h1{font-size:50px;margin:10px 0 14px}
  .lede{font-size:15px}
  .facts{margin-top:20px;padding-top:14px}
  .facts dt{font-size:30px}
  .facts dd{font-size:11.5px}
  .skyline{height:56px}
  .block{padding-top:26px}
  .block.first{padding-top:18px}
  .block.sec{break-before:page;padding-top:0}
  h2{font-size:28px}
  .greet,.intro{font-size:14px;margin-bottom:14px}
  .verdict{padding:20px 24px;break-inside:avoid}
  .verdict p.say{font-size:20px}
  .throne .ceiling .wrap{padding-inline:32px}
  .ceil-links dt{font-size:10.5px}
  .ceil-links dd{font-size:12px}
  .skyline.ceiling-edge{height:18px}
  .chain{gap:14px}
  .cell{padding:18px 22px;break-inside:avoid}
  .cell-no{font-size:32px}
  .cell h3{font-size:17px}
  .cell .body,.raw q,.split li,.example,.bind{font-size:12.5px}
  .laws li,.loose li{break-inside:avoid;padding:11px 0}
  .laws .num{font-size:22px}
  .laws .law{font-size:14px}
  .laws .why{font-size:12.5px}
  .sealed{margin-top:26px;border-radius:16px;overflow:hidden;break-inside:avoid}
  .sealed .wrap{padding:18px 32px 26px}
  .sealed .skyline{height:28px}
  .sealed p.who{font-size:15px}
}
`;
export const CSS: string = CSS_SRC;

const PRE_VAR = /:root\s*\{[^{}]*--[a-z0-9-]+\s*:[^{}]*\}/g;
const VAR = /var\(--([a-z0-9-]+)\)/g;

export function paint(css: string, mode: Mode, pdf = false): string {
  const tokens: Record<string, string> = { ...TOKENS[mode], ...(pdf ? PDF_PAPER : {}) };
  const stripped = css.replace(PRE_VAR, "");
  const out = stripped.replace(VAR, (_m, name: string) => {
    if (!(name in tokens)) throw new KeyError(name);
    return tokens[name];
  });
  if (out.includes("var(--")) throw new Error("unresolved CSS var in painted output");
  return out;
}

export class KeyError extends Error {
  constructor(key: string) {
    super(`KeyError: '${key}'`);
  }
}

type Pt = [number, number];

export function skyline(back = true, cls = "skyline"): string {
  const frontL: Pt[] = [[0, 96], [0, 72], [50, 72], [50, 64], [80, 64], [80, 72], [140, 72], [160, 44],
    [180, 72], [230, 72], [230, 60], [262, 60], [262, 72], [320, 72], [344, 30],
    [368, 72], [420, 72], [420, 56], [452, 56], [452, 72], [500, 72], [528, 26],
    [548, 58], [572, 58], [600, 2]];
  const backL: Pt[] = [[0, 96], [0, 58], [96, 58], [118, 24], [140, 58], [250, 58], [250, 46], [290, 46],
    [290, 58], [380, 58], [404, 16], [428, 58], [470, 58], [470, 40], [506, 40],
    [506, 58], [540, 58], [566, 8], [592, 40], [600, 40]];

  const pts = (left: Pt[]): string => {
    const full: Pt[] = [...left, ...left.slice(0, -1).reverse().map(([x, y]): Pt => [1200 - x, y])];
    return full.map(([x, y]) => `${x},${y}`).join(" ");
  };

  const backPoly = back ? `<polygon class="sky-back" points="${pts(backL)}"/>` : "";
  return (
    `<svg class="${cls}" viewBox="0 0 1200 96" preserveAspectRatio="none" aria-hidden="true">` +
    `${backPoly}<polygon class="sky-front" points="${pts(frontL)}"/></svg>`
  );
}

function lum(hex: string): number {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Python f"{x:.Nf"} equivalent: exact binary value, round-half-even on exact ties.
 * (JS toFixed rounds ties up, so it is not used.) Finite values only.
 */
export function formatFixed(x: number, digits: number): string {
  if (!Number.isFinite(x)) throw new Error("formatFixed: non-finite");
  const neg = x < 0 || Object.is(x, -0);
  const ax = Math.abs(x);
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, ax);
  const hi = dv.getUint32(0);
  const lo = dv.getUint32(4);
  const expBits = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << BigInt(32)) | BigInt(lo);
  let e2: number;
  if (expBits === 0) {
    e2 = -1074;
  } else {
    mant = mant | (BigInt(1) << BigInt(52));
    e2 = expBits - 1075;
  }
  const scale = BigInt(10) ** BigInt(digits);
  let q: bigint;
  if (e2 >= 0) {
    q = (mant << BigInt(e2)) * scale;
  } else {
    const den = BigInt(1) << BigInt(-e2);
    const num = mant * scale;
    q = num / den;
    const r2 = (num % den) * BigInt(2);
    if (r2 > den || (r2 === den && (q & BigInt(1)) === BigInt(1))) q += BigInt(1);
  }
  const s = q.toString().padStart(digits + 1, "0");
  const body = digits > 0 ? `${s.slice(0, -digits)}.${s.slice(-digits)}` : s;
  return (neg ? "-" : "") + body;
}

// (text, background, minimum ratio). Ratio is a number so 3 prints as "3", 4.5 as "4.5", as in Python.
export const PAIRS: [string, string, number][] = [
  ["ink", "paper", 4.5], ["ink", "cell", 4.5], ["soft", "paper", 4.5], ["soft", "cell", 4.5],
  ["frost", "paper", 4.5], ["frost", "cell", 4.5], ["ember", "rime", 4.5], ["soft", "rime", 4.5],
  ["muted", "cell", 3], ["night-ink", "night", 4.5], ["night-soft", "night", 4.5],
  ["glacier", "night-cell", 4.5], ["ember-lit", "night-cell", 4.5],
  ["ok", "ok-bg", 4.5], ["info", "info-bg", 4.5], ["risk", "risk-bg", 4.5], ["gold", "cell", 4.5],
];

export interface CheckResult {
  lines: string[];
  fails: string[];
  code: 0 | 1;
}

/** Python check(), returned as data instead of printed. */
export function check(): CheckResult {
  const fails: string[] = [];
  const lines: string[] = [];
  const keySets = (Object.keys(TOKENS) as Mode[]).map((m) => new Set(Object.keys(TOKENS[m])));
  const sameKeys = keySets.every((s) => s.size === keySets[0].size && [...s].every((k) => keySets[0].has(k)));
  if (!sameKeys) {
    const a = keySets[0], b = keySets[1];
    const diff = [...[...a].filter((k) => !b.has(k)), ...[...b].filter((k) => !a.has(k))].sort();
    fails.push(`key mismatch: [${diff.map((d) => `'${d}'`).join(", ")}]`);
  }
  for (const mode of Object.keys(TOKENS) as Mode[]) {
    const t = TOKENS[mode];
    for (const [fg, bg, need] of PAIRS) {
      const r = contrast(t[fg], t[bg]);
      const flag = r >= need ? "ok  " : "FAIL";
      lines.push(`${flag} ${mode.padEnd(6)} ${fg.padStart(10)} on ${bg.padEnd(10)} ${formatFixed(r, 2).padStart(5)} (need ${String(need)})`);
      if (r < need) fails.push(`${mode} ${fg} on ${bg}: ${formatFixed(r, 2)} < ${String(need)}`);
    }
  }
  const used = new Set([...CSS.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]));
  const unused = [...used].filter((k) => !keySets[0].has(k)).sort();
  if (unused.length) fails.push(`CSS names unknown tokens: [${unused.map((d) => `'${d}'`).join(", ")}]`);
  lines.push(fails.length ? fails.join("\n") : "warden tokens: clean");
  return { lines, fails, code: fails.length ? 1 : 0 };
}
