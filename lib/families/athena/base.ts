// Athena base: a 1:1 port of artifactHtml/src/athena_base.py.
// TOKENS are identical hex. CSS names tokens as var(--name); paint() swaps every one for its literal
// value, so shipped HTML carries no custom properties and no theme switch (the skill's hard lock).
// Parity receipt: `npx tsx scripts/tokencheck.ts athena` prints the same check() output as `python3 athena_base.py --check`.

export const PLEX = '"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
export const MONO = '"IBM Plex Mono",ui-monospace,Menlo,monospace';

export const FONTS =
  '<meta name="color-scheme" content="light only">\n' +
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">';

// Hex values are the approved v1 oklch tokens, rounded to sRGB.
export const TOKENS: Record<string, string> = {
  "canvas": "#EEF0F5", // Athens Gray page (Shad, v1 approved)
  "card": "#FFFFFF", // oklch(1 0 0)
  "surface-2": "#ECEFF2", // oklch(0.95 0.005 260) nested fills, pills
  "surface-glass": "rgba(231,234,240,.72)", // oklch(0.9365 0.008 265 / 72%) sticky bars
  "sidebar": "#F9FAFB", // oklch(0.985 0.002 260)
  "border": "#D5D8DB", // oklch(0.88 0.006 260)
  "ink-hi": "#111114", // oklch(0.18 0.005 270)
  "ink-mid": "#5F636A", // oklch(0.50 0.012 260)
  "ink-low": "#6E7278", // oklch(0.55 0.01 260) non-content only
  "primary": "#006BE8", // oklch(0.55 0.21 256)
  "primary-fg": "#FCFCFC", // oklch(0.99 0 0)
  "risk": "#D42325", // oklch(0.56 0.21 27) passive state
  "risk-fg": "#FCFCFC",
  "destructive": "#C20000", // oklch(0.50 0.22 27) confirm actions
  "destructive-fg": "#FCFCFC",
  "warn": "#DC9E12", // oklch(0.74 0.15 80) fill only
  "warn-fg": "#241E14", // oklch(0.24 0.02 80)
  "warn-text": "#8E5400", // oklch(0.50 0.12 70) text only
  "ok": "#137D41", // oklch(0.52 0.13 152)
  "ok-fg": "#FCFCFC",
  "sans": PLEX,
  "mono": MONO,
};

// Shape tokens: plain values, not colours.
export const SHAPE: Record<string, string> = {
  "radius-tile": "18px",
  "radius-inner": "10px",
  "radius-pill": "999px",
  "gap": "16px",
};

// Text pairs that must clear WCAG AA (4.5:1). Background first, text second.
export const CONTRAST_PAIRS: [string, string][] = [
  ["canvas", "ink-hi"], ["canvas", "ink-mid"], ["canvas", "ink-low"],
  ["card", "ink-hi"], ["card", "ink-mid"],
  ["primary", "primary-fg"], ["risk", "risk-fg"], ["destructive", "destructive-fg"],
  ["warn", "warn-fg"], ["ok", "ok-fg"],
  ["canvas", "primary"], ["canvas", "risk"], ["canvas", "ok"], ["canvas", "warn-text"],
];
// Known below AA by design: ink-low is for non-content only; warn fill is never text.
export const BELOW_AA_BY_DESIGN = new Set<string>(["canvas|ink-low"]);
// Passes only at 14px bold or larger (AA large text, 3:1). Primary-coloured text on the canvas.
export const LARGE_TEXT_ONLY = new Set<string>(["canvas|primary"]);

function lum(hex: string): number {
  const h = hex.replace(/^#/, "");
  const ch = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Replace var(--name) with literal values. Unknown names fail loudly. */
export function paint(css: string): string {
  return css.replace(/var\(--([a-z0-9-]+)\)/g, (_m, name: string) => {
    if (name in TOKENS) return TOKENS[name];
    if (name in SHAPE) return SHAPE[name];
    throw new Error(`athena_base: unknown token --${name}`);
  });
}

/** Same output text as `python3 athena_base.py --check`. Prints, returns exit code. */
export function check(): number {
  let ok = true;
  for (const [a, b] of CONTRAST_PAIRS) {
    const key = `${a}|${b}`;
    const r = contrast(TOKENS[a], TOKENS[b]);
    if (BELOW_AA_BY_DESIGN.has(key)) {
      console.log(`  note  ${a} / ${b}: ${r.toFixed(2)}:1 (below AA, non-content by design)`);
      continue;
    }
    if (LARGE_TEXT_ONLY.has(key)) {
      const status = r >= 3.0 ? "ok  " : "FAIL";
      if (r < 3.0) ok = false;
      console.log(`  ${status}  ${a} / ${b}: ${r.toFixed(2)}:1 (large text only, 14px bold+)`);
      continue;
    }
    const status = r >= 4.5 ? "ok  " : "FAIL";
    if (r < 4.5) ok = false;
    console.log(`  ${status}  ${a} / ${b}: ${r.toFixed(2)}:1`);
  }
  console.log(ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}

/** Same escaping as Python html.escape(s, quote=True). */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Inline rich text: escape FIRST, then convert **bold** and `code`. Code spans are split out before bold runs,
 *  so markers inside code stay literal. Escaping first means no tag can come from user text. */
export function rich(s: string): string {
  return esc(s)
    .split(/`([^`]*)`/)
    .map((seg, i) => (i % 2 === 1 ? `<code>${seg}</code>` : seg.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")))
    .join("");
}

// Pairs the athena blocks actually use for text (receipt c). Same tokens as CONTRAST_PAIRS where they overlap.
// Topbar text sits on surface-glass; it is checked against canvas, the colour the glass sits over.
export const BLOCK_TEXT_PAIRS: [string, string][] = [
  ["canvas", "ink-hi"], ["canvas", "ink-mid"],
  ["card", "ink-hi"], ["card", "ink-mid"],
  ["sidebar", "ink-hi"], ["sidebar", "ink-mid"],
  ["surface-2", "ink-hi"], ["surface-2", "ink-mid"],
];

/**
 * The shell and bento CSS, written with var() names. Shared by every athena page.
 * parity: harness.py reads this exact template literal. Keep it free of backticks and ${.
 */
export const ATHENA_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{color-scheme:light only}
html,body{margin:0}
body{background:var(--canvas);color:var(--ink-hi);font-family:var(--sans);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.shell{display:grid;grid-template-columns:232px minmax(0,1fr);min-height:100vh}
.sidebar{background:var(--sidebar);border-right:1px solid var(--border);padding:20px 14px}
.brand{font-weight:700;font-size:15px;letter-spacing:-.01em;padding:4px 10px 18px}
.brand small{display:block;font-weight:400;color:var(--ink-mid);font-size:12px}
.main{min-width:0}
.topbar{position:sticky;top:0;z-index:10;background:var(--surface-glass);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);border-bottom:1px solid var(--border);padding:12px 24px;display:flex;gap:16px;align-items:center}
.crumb{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.content{padding:24px}
.bento{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--gap)}
.span-3{grid-column:span 3}
.span-4{grid-column:span 4}
.span-8{grid-column:span 8}
.span-12{grid-column:span 12}
.head{grid-column:1/-1;display:flex;flex-direction:column;gap:6px;padding:4px 2px 8px}
.head .eyebrow{margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-mid)}
.head h1{margin:0;font-size:28px;font-weight:600;letter-spacing:-.02em;line-height:1.15;text-wrap:balance}
.head .lede{margin:0;color:var(--ink-mid);max-width:70ch}
.tile{background:var(--card);border:1px solid var(--border);border-radius:var(--radius-tile);padding:18px;min-width:0;display:flex;flex-direction:column;gap:12px}
.tile h3{margin:0;font-size:17px;font-weight:600;letter-spacing:-.01em;line-height:1.3}
.tile p{margin:0}
.label{margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-mid)}
.num{font-family:var(--mono);font-size:32px;font-weight:500;letter-spacing:-.02em;line-height:1.1;color:var(--ink-hi)}
.plain{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.tbl{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;color:var(--ink-mid);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:top}
td{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:top;color:var(--ink-hi)}
.list{display:flex;flex-direction:column;margin:0;padding:0;list-style:none}
.row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 2px;border-top:1px solid var(--border)}
.row:first-child{border-top:0}
.row.plain-row{grid-template-columns:minmax(0,1fr)}
.row .name{font-weight:500;min-width:0;overflow-wrap:anywhere}
.row .meta{font-family:var(--mono);font-size:12px;color:var(--ink-mid);text-align:right;white-space:nowrap}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.dot.ok{background:var(--ok)}
.dot.warn{background:var(--warn)}
.dot.risk{background:var(--risk)}
.callout{border-left:4px solid var(--border)}
.callout.info{border-left-color:var(--primary)}
.callout.warn{border-left-color:var(--warn)}
.callout.ok{border-left-color:var(--ok)}
.callout .label{color:var(--ink-hi)}
.seal{font-size:12px;color:var(--ink-mid);border-top:1px solid var(--border);padding-top:14px;gap:4px}
.seal p{margin:0}
.note{margin:0;font-size:12px;color:var(--ink-mid)}
code{font-family:var(--mono);font-size:.92em;background:var(--surface-2);color:var(--ink-hi);border-radius:var(--radius-inner);padding:1px 5px;font-variant-ligatures:none}
strong{font-weight:600;color:var(--ink-hi)}
.section{grid-column:1/-1;margin:12px 0 0;padding-top:16px;border-top:1px solid var(--border);font-size:20px;font-weight:600;letter-spacing:-.015em;line-height:1.25;color:var(--ink-hi)}
.fig{margin:0}
.fig img{display:block;width:100%;height:auto;border:1px solid var(--border);border-radius:var(--radius-inner)}
.fig figcaption{font-size:12px;color:var(--ink-mid)}
.flow-wrap{overflow-x:auto}
.flow-wrap svg{display:block}
@media (max-width:1080px){.span-3,.span-4{grid-column:span 6}.span-8{grid-column:span 12}}
@media (max-width:760px){
  .shell{grid-template-columns:1fr}
  .sidebar{display:none}
  .content{padding:16px}
  .topbar{padding:10px 16px}
  .bento{grid-template-columns:minmax(0,1fr)}
  .span-3,.span-4,.span-8,.span-12{grid-column:1/-1}
  .head h1{font-size:24px}
  .num{font-size:26px}
}
`;
