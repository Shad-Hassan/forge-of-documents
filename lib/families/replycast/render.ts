// 1:1 port of ~/.claude/skills/replyCast/build.py (v2 look, 2026-10-08) render path.
// Same tag order, attribute order, inline styles, whitespace and escaping as the Python source.
import type { Draft } from "./schema";

type Rec = Record<string, unknown>;

const INK = "#1B1F23", SOFT = "#4F575E", MUTED = "#80888F", HAIR = "#E3E6E8", RULE = "#CDD2D5";
const PAPER = "#F1F3F4", CARD = "#FFFFFF", NAVY = "#2E4A66";
const TONES: Record<string, [string, string]> = {
  warn: ["#8A6414", "#FBF4E2"],
  danger: ["#9A4A3A", "#F8E9E5"],
  ok: ["#2F6B4F", "#EAF4EE"],
  reach: ["#1E8E4E", "#E5F6EA"],
  info: ["#2E4A66", "#EDF1F5"],
  ask: ["#5B45C2", "#F4F1FD"],
  "danger-soft": ["#C98476", "#FCF4F2"],
  orange: ["#B85C1E", "#FCEEE3"],
  go: ["#2F6B4F", "#FFFFFF"],
};
const TONE_ORDER = Object.keys(TONES);
const FONT = "'Geist',Helvetica,Arial,sans-serif";
const GLYPH_FONT = "Arial,Helvetica,sans-serif";
const BODY = `margin:0;font-family:${FONT};font-size:16px;line-height:32px;color:${INK}`;

// Python str.isspace() set, so \s in the URL regexes matches what Python's re matches.
const PY_SPACE = "\\t\\n\\v\\f\\r \\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const URL_RE = new RegExp(`https?://[^${PY_SPACE}<]+`, "g");
const ISO_DATE_RE = /\p{Nd}{4}-\p{Nd}{2}-\p{Nd}{2}/gu; // Python \d on str = Unicode Nd
const MD_LINK_RE = new RegExp(`\\[([^\\]]+)\\]\\((https?://[^)${PY_SPACE}]+)\\)`, "g");
const BUTTON_FROM = "#5A0FC8", BUTTON_TO = "#D0189B";

/** Python html.escape(s, quote=True). */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Python str.replace(chr(10), "<br>"). */
function nl(s: string): string {
  return s.split("\n").join("<br>");
}

/** Python str.rstrip(".,;:)!?"). */
function rstripPunct(s: string): string {
  return s.replace(/[.,;:)!?]+$/, "");
}

function plain(segment: string): string {
  let out = "";
  let last = 0;
  for (const m of segment.matchAll(ISO_DATE_RE)) {
    const start = m.index as number;
    out += esc(segment.slice(last, start));
    out += `<span style="white-space:nowrap">${m[0]}</span>`;
    last = start + m[0].length;
  }
  out += esc(segment.slice(last));
  return out;
}

function button(label: string, url: string): string {
  return (
    `<a href="${esc(url)}" style="display:inline-block;padding:0 16px;border-radius:8px;` +
    `background-color:${BUTTON_FROM};background-image:linear-gradient(135deg,${BUTTON_FROM},${BUTTON_TO});` +
    `font-family:${FONT};font-size:16px;font-weight:600;line-height:32px;color:#FFFFFF;text-decoration:none">` +
    `${esc(label)}</a>`
  );
}

function bareLinks(text: string, weight = 500): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index as number;
    const url = rstripPunct(m[0]);
    out += plain(text.slice(last, start));
    out +=
      `<a href="${esc(url)}" style="color:${NAVY};text-decoration:underline;text-decoration-color:#AFC0D1;` +
      `font-weight:${weight};overflow-wrap:anywhere;word-break:normal">${esc(url)}</a>`;
    last = start + url.length;
  }
  out += plain(text.slice(last));
  return out;
}

function linkify(text: string, weight = 500): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(MD_LINK_RE)) {
    const start = m.index as number;
    out += bareLinks(text.slice(last, start), weight);
    out += button(m[1], m[2]);
    last = start + m[0].length;
  }
  out += bareLinks(text.slice(last), weight);
  return out;
}

function row(inner: string, pad = "0 0 16px 0"): string {
  return `<tr><td style="padding:${pad}">${inner}</td></tr>`;
}

function para(text: string): string {
  return row(`<p style="${BODY};overflow-wrap:anywhere;word-break:break-word">${nl(linkify(text))}</p>`);
}

function badge(glyph: string, fg: string): string {
  return (
    `<td valign="top" width="24" style="width:24px;padding:0 16px 0 0">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="24" height="24" align="center" valign="middle" bgcolor="${fg}" style="width:24px;height:24px;` +
    `background-color:${fg};border-radius:8px;font-family:${GLYPH_FONT};font-size:16px;font-weight:700;` +
    `line-height:24px;color:#FFFFFF;mso-line-height-rule:exactly">${esc(glyph)}</td>` +
    `</tr></table></td>`
  );
}

function toned(kind: string, text: string, icon = ""): string {
  const [fg, bg] = TONES[kind];
  let body = `<p style="${BODY};color:${INK}">${nl(linkify(text))}</p>`;
  if (icon) {
    body =
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `${badge(icon, fg)}<td valign="top">${body}</td></tr></table>`;
  }
  // "ask" (decision) and "go" (clean green outline) get a full border so they read apart from the left-accent blocks.
  const edge =
    kind === "ask" || kind === "go"
      ? `border:1.5px solid ${fg};border-radius:16px;padding:16px`
      : `border-left:3px solid ${fg};border-radius:0 8px 8px 0;padding:16px`;
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      `<tr><td bgcolor="${bg}" style="background-color:${bg};${edge}">${body}</td></tr></table>`,
    "0 0 16px 0",
  );
}

function shot(url: string, caption: string): string {
  let img: string;
  if (url) {
    img =
      `<img src="${esc(url)}" width="576" alt="${esc(caption || "Screenshot")}" ` +
      `style="display:block;width:100%;max-width:576px;height:auto;border:1px solid ${HAIR};border-radius:8px">`;
  } else {
    img =
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      `<tr><td height="160" align="center" bgcolor="#F7F8F9" style="background-color:#F7F8F9;` +
      `border:1.5px dashed ${RULE};border-radius:8px;height:160px;font-family:${FONT};` +
      `font-size:16px;color:${MUTED}">Paste screenshot here</td></tr></table>`;
  }
  const cap = caption
    ? `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:16px;line-height:24px;color:${MUTED}">${esc(caption)}</p>`
    : "";
  return row(img + cap, "0 0 24px 0");
}

function stamp(text: string, kind = "danger"): string {
  const [fg, bg] = TONES[kind];
  return (
    `<span style="display:inline-block;padding:0 8px;border:1px solid ${fg};border-radius:8px;` +
    `background-color:${bg};font-family:${FONT};font-size:16px;line-height:24px;font-weight:600;` +
    `color:${fg}">${linkify(text)}</span>`
  );
}

interface TableIn {
  head: string[];
  rows: string[][];
  highlight?: number[];
  row_tones?: string[];
  tone?: string;
  stamp?: boolean;
}

function table(t: TableIn): string {
  const head = t.head;
  const hi = new Set(t.highlight ?? []);
  const rowTones = t.row_tones ?? [];
  const items: string[] = [];
  t.rows.forEach((r, i) => {
    const kind =
      (i < rowTones.length ? rowTones[i] : "") || t.tone || (hi.has(i) ? "warn" : "");
    const [fg, bg] = kind ? TONES[kind] : [HAIR, CARD];
    const metaC = kind ? fg : MUTED;
    const meta = r.slice(0, 2).map(esc).join(" · ");
    let extra = "";
    for (let j = 3; j < r.length; j++) {
      extra += t.stamp
        ? `<p style="margin:8px 0 0 0">${stamp(`${head[j]}: ${r[j]}`)}</p>`
        : `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:16px;line-height:24px;color:${MUTED}">` +
          `${esc(head[j])}: ${linkify(r[j])}</p>`;
    }
    const edge = kind
      ? `border-left:3px solid ${fg};border-radius:0 8px 8px 0;padding:16px`
      : `border-top:${i === 0 ? "0" : "1px solid " + HAIR};padding:16px 0`;
    const gap =
      i === 0 || !kind
        ? ""
        : '<tr><td height="8" style="height:8px;line-height:8px;font-size:0">&nbsp;</td></tr>';
    items.push(
      `${gap}<tr><td bgcolor="${bg}" style="background-color:${bg};${edge}">` +
        `<p style="margin:0 0 8px 0;font-family:${FONT};font-size:16px;line-height:24px;font-weight:600;color:${metaC};overflow-wrap:anywhere;word-break:break-word">${meta}</p>` +
        `<p style="margin:0;font-family:${FONT};font-size:16px;line-height:24px;color:${INK}">${linkify(r[2])}</p>` +
        `${extra}</td></tr>`,
    );
  });
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.join("")}</table>`,
    "0 0 16px 0",
  );
}

function heading(text: string): string {
  return row(
    `<h1 style="margin:0;font-family:${FONT};font-size:24px;line-height:32px;font-weight:600;` +
      `letter-spacing:-0.01em;color:${INK}">${esc(text)}</h1>`,
    "8px 0 16px 0",
  );
}

function subheading(text: string): string {
  return row(
    `<h2 style="margin:0;font-family:${FONT};font-size:16px;line-height:24px;font-weight:600;` +
      `color:${INK}">${esc(text)}</h2>`,
    "8px 0 8px 0",
  );
}

const H3 = `margin:0;font-family:${FONT};font-size:16px;line-height:24px;font-weight:600;color:${INK};overflow-wrap:anywhere;word-break:break-word`;

function lead(text: string, url: string): string {
  const shown = esc(url).split("/").join("/<wbr>");
  return row(
    `<p style="margin:0;font-family:${FONT};font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.015em;` +
      `color:${INK}">${esc(text)}</p>` +
      `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:24px;line-height:32px;font-weight:600">` +
      `<a href="${esc(url)}" style="color:${NAVY};text-decoration:underline;text-decoration-color:#AFC0D1;` +
      `font-weight:600;word-break:normal;overflow-wrap:break-word">${shown}</a></p>`,
    "0 0 24px 0",
  );
}

function tag(text: string): string {
  return row(
    `<span style="display:inline-block;padding:8px 16px;border-radius:1000px;font-family:${FONT};font-size:16px;` +
      `font-weight:500;line-height:24px;letter-spacing:0.01em;border:1px solid rgba(46,74,102,0.35);` +
      `background-color:#EDF1F5;background:linear-gradient(135deg,rgba(46,74,102,0.12),rgba(46,74,102,0.04));` +
      `color:${NAVY}">${esc(text)}</span>`,
    "24px 0 8px 0",
  );
}

function h3(text: string): string {
  return row(`<h3 style="${H3}">${esc(text)}</h3>`, "8px 0 8px 0");
}

interface UrlMapIn {
  title: string;
  /** Record (Python dict, from draft files) or ordered [key, value] pairs (from the generation path, where JS would reorder integer-like keys). */
  items: Record<string, string> | Array<[string, string]>;
  empty?: string;
}

function urlmap(m: UrlMapIn): string {
  const empty = m.empty !== undefined ? m.empty : "No URL added yet";
  const items = (Array.isArray(m.items) ? m.items : Object.entries(m.items))
    .map(([k, v], i) => {
      const value = v
        ? `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:16px;line-height:24px;overflow-wrap:anywhere;` +
          `word-break:break-word">${linkify(v)}</p>`
        : `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:16px;line-height:24px;color:${MUTED}">${esc(empty)}</p>`;
      return (
        `<tr><td style="padding:${i === 0 ? "0" : "16px"} 0 0 0"><h3 style="${H3}">${esc(k)}</h3>` + value + `</td></tr>`
      );
    })
    .join("");
  return row(
    `<h3 style="${H3}">${esc(m.title)}</h3>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">` +
      `<tr><td style="border-left:1px solid ${RULE};padding:0 0 0 16px">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>` +
      `</td></tr></table>`,
    "0 0 24px 0",
  );
}

const has = (b: Rec, k: string): boolean => Object.prototype.hasOwnProperty.call(b, k);
const str = (v: unknown): string => v as string;

function block(b: Rec): string {
  if (has(b, "lead")) return lead(str(b.lead), b.url !== undefined ? str(b.url) : "");
  if (has(b, "tag")) return tag(str(b.tag));
  if (has(b, "urls")) return urlmap(b.urls as UrlMapIn);
  if (has(b, "h1")) return heading(str(b.h1));
  if (has(b, "h2")) return subheading(str(b.h2));
  if (has(b, "h3")) return h3(str(b.h3));
  if (has(b, "p")) return para(str(b.p));
  if (has(b, "shot")) return shot(str(b.shot), b.caption !== undefined ? str(b.caption) : "");
  if (has(b, "table")) return table(b.table as TableIn);
  const kind = TONE_ORDER.find((k) => has(b, k));
  if (kind === undefined) throw new Error("block has no known key");
  return toned(kind, str(b[kind]), b.icon !== undefined ? str(b.icon) : "");
}

export function render(d: Draft): string {
  const dd = d as unknown as Rec & { blocks: Rec[]; after?: Rec[] };
  const greet = dd.greeting ? [row(`<p style="${BODY}">${esc(str(dd.greeting))}</p>`, "0 0 16px 0")] : [];
  const rows: string[] = dd.blocks.map(block);
  if (dd.signoff || dd.name) {
    const signoff = dd.signoff !== undefined ? str(dd.signoff) : "";
    const name = dd.name !== undefined ? str(dd.name) : "";
    rows.push(
      row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
          `<tr><td style="border-top:1px solid ${HAIR};padding-top:16px">` +
          `<p style="margin:0;font-family:${FONT};font-size:16px;line-height:24px;color:${SOFT}">${esc(signoff)}</p>` +
          `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:16px;line-height:24px;font-weight:600;color:${INK}">${esc(name)}</p>` +
          `</td></tr></table>`,
        "8px 0 0 0",
      ),
    );
  }
  const after = (dd.after ?? []).map(block);
  if (after.length) {
    rows.push(row("", "0 0 16px 0"));
    rows.push(...after);
  }
  // v3 left spine: the last block drops its bottom gap so the spine ends with the text.
  const lastIdx = rows.length - 1;
  if (lastIdx >= 0 && rows[lastIdx].startsWith('<tr><td style="padding:0 0 16px 0">')) {
    rows[lastIdx] = rows[lastIdx].replace("padding:0 0 16px 0", "padding:0");
  }
  // The spine runs only beside the body, never the greeting. The body is indented 16px from it.
  const spine =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td style="border-left:3px solid ${NAVY};padding:0 0 0 16px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("\n")}</table>` +
    `</td></tr></table>`;
  const all = greet.concat([row(spine, "0 0 0 0")]);
  const subject = dd.subject !== undefined ? str(dd.subject) : str(dd.slug);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap">
<style>:root{color-scheme:light only;supported-color-schemes:light}</style>
</head>
<body style="margin:0;padding:0;background-color:${PAPER}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background-color:${PAPER}">
<tr><td align="center" style="padding:24px 16px">
<!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="width:100%;max-width:640px;background-color:${CARD};border:1px solid ${HAIR};border-radius:16px">
<tr><td style="padding:32px 32px 32px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${all.join("\n")}
</table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}

/**
 * Port of build.py paste_fragment(page): body-only copy for pasting into Gmail. Gmail drops <head>, <style>
 * and max-width on paste, so the card gets a width attribute (640) that survives, and the body stays inline-only.
 */
export function pasteFragment(page: string): string {
  const open = page.indexOf("<body");
  const afterOpen = page.slice(open + "<body".length);
  const inner = afterOpen.slice(afterOpen.indexOf(">") + 1);
  const closeAt = inner.lastIndexOf("</body>");
  const body = closeAt === -1 ? inner : inner.slice(0, closeAt);
  const card = `width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="width:100%;max-width:640px;`;
  const cardPaste = `width="640" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="width:640px;max-width:640px;`;
  return body.replace(card, cardPaste).trim() + "\n";
}

/** Paste-ready fragment: the email page, reduced to its body (build.py writes this as <slug>.paste.html). */
export function renderPaste(d: Draft): string {
  return pasteFragment(render(d));
}
