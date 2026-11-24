// Port of warden_email.py: pill, tile, heading, raw, text, hero, links, shell.
// Table-only email in print tokens. Signatures and parameter order match the Python.
import { TOKENS, fonts } from "./base";

const P = TOKENS.print;
const F = "font-family:'IBM Plex Sans',Helvetica,Arial,sans-serif";
const C = "font-family:'IBM Plex Sans Condensed','IBM Plex Sans',Helvetica,Arial,sans-serif";
const TABLE = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"';

export const PILL_KINDS = [
  "blocking", "high", "open", "deferred", "ok", "fail",
  "lean", "live", "bloat",
  "recorded", "audit",
] as const;
export type PillKind = (typeof PILL_KINDS)[number];

const PILL: Record<PillKind, [string, string, string]> = {
  blocking: ["risk", "!", "Blocking"],
  high: ["info", "!", "High"],
  open: ["info", "i", "Open"],
  deferred: ["neutral", "–", "Deferred"],
  ok: ["ok", "✓", "Pass"],
  fail: ["risk", "!", "Fail"],
  // Skill size against the ~200-word SKILL.md target: lean <= 250 words, bloat past twice the target.
  lean: ["ok", "✓", "Lean"],
  live: ["neutral", "·", "Live"],
  bloat: ["risk", "!", "Bloat"],
  // Artifact registry categories: every live page recorded, or some still pending audit.
  recorded: ["ok", "✓", "Recorded"],
  audit: ["info", "i", "Needs audit"],
};

/** Python html.escape(s, quote=True). */
export function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function pill(kind: PillKind): string {
  const [tone, glyph, label] = PILL[kind];
  const [bg, ink] = tone === "neutral" ? [P.rime, P.soft] : [P[`${tone}-bg`], P[tone]];
  return (
    `<span style="${F};display:inline-block;background:${bg};color:${ink};font-size:12px;font-weight:600;` +
    `padding:3px 10px;border-radius:999px;white-space:nowrap">${glyph}&nbsp;${label}</span>`
  );
}

export function tile(inner: string, top?: string, pad = "24px 22px"): string {
  return (
    `<tr><td style="padding-top:14px"><table ${TABLE} style="background:${P.cell};border:1px solid ${P.ice};` +
    `border-top:${top || "1px solid " + P.ice};border-radius:16px"><tr><td style="padding:${pad}">${inner}</td></tr></table></td></tr>`
  );
}

export function heading(text: string, intro = ""): string {
  const sub = intro
    ? `<div style="${F};font-size:16px;line-height:1.5;color:${P.soft};padding-top:6px">${escape(intro)}</div>`
    : "";
  return (
    `<tr><td style="padding:36px 4px 2px"><div style="${F};font-size:28px;font-weight:700;line-height:1.1;` +
    `letter-spacing:-0.5px;color:${P.ink}">${escape(text)}</div>${sub}</td></tr>`
  );
}

export function raw(text: string, dark = false, tag = "Raw intake"): string {
  const [bg, tg, ink] = dark ? [P["night-cell"], P["ember-lit"], P["night-ink"]] : [P.rime, P.ember, P.soft];
  return (
    `<table ${TABLE} style="margin-top:12px"><tr><td style="background:${bg};border-left:2px solid ${P.ember};` +
    `border-radius:0 10px 10px 0;padding:10px 14px">` +
    `<div style="${F};font-size:12px;font-weight:600;color:${tg};line-height:1.4">${escape(tag)}</div>` +
    `<div style="${F};font-size:15px;line-height:1.5;color:${ink};overflow-wrap:anywhere">“${escape(text)}”</div></td></tr></table>`
  );
}

export function text(s: string, size: number = 16, color?: string, weight: number = 400, pad: string = "0"): string {
  return (
    `<div style="${F};font-size:${size}px;font-weight:${weight};line-height:1.5;color:${color || P.ink};` +
    `padding:${pad};overflow-wrap:anywhere;word-break:break-word">${escape(s)}</div>`
  );
}

export function hero(
  kicker: string,
  h1: string,
  lede: string,
  facts: [string | number, string][],
  extra = "",
): string {
  const cells = facts
    .map(
      ([n, l]) =>
        `<td valign="top" width="${Math.floor(100 / facts.length)}%" style="padding-right:8px">` +
        `<div style="${C};font-size:30px;font-weight:700;line-height:1;color:${P["night-ink"]}">${escape(String(n))}</div>` +
        `<div style="${F};font-size:12px;line-height:1.35;color:${P["night-soft"]};padding-top:6px;overflow-wrap:anywhere">${escape(l)}</div></td>`,
    )
    .join("");
  return (
    `<tr><td bgcolor="${P.night}" style="background:${P.night};border-radius:16px;padding:28px 24px">` +
    `<div style="${F};font-size:14px;font-weight:500;color:${P["night-soft"]};overflow-wrap:anywhere">${escape(kicker)}</div>` +
    `<div style="${C};font-size:40px;font-weight:700;line-height:1;letter-spacing:-1px;color:${P["night-ink"]};padding-top:12px;overflow-wrap:anywhere">${escape(h1)}</div>` +
    `<div style="${F};font-size:17px;line-height:1.5;color:${P["night-soft"]};padding-top:16px;overflow-wrap:anywhere">${escape(lede)}</div>` +
    `<table ${TABLE} style="margin-top:24px;border-top:1px solid ${P["night-line"]}">` +
    `<tr><td colspan="${facts.length}" style="height:18px;line-height:18px;font-size:0">&nbsp;</td></tr><tr>${cells}</tr></table>` +
    `${extra}</td></tr>`
  );
}

export function links(url: string, pdfName: string): string {
  const a =
    `<a href="${escape(url)}" style="color:${P.frost};text-decoration:underline;word-break:break-all">${escape(url)}</a>`;
  return (
    `<tr><td style="padding:14px 4px 0">` +
    `<div style="${F};font-size:14px;line-height:1.5;color:${P.soft}">Live page: ${a}</div>` +
    `<div style="${F};font-size:14px;line-height:1.5;color:${P.soft}"><strong>PDF attached:</strong> ${escape(pdfName)}</div></td></tr>`
  );
}

export function shell(title: string, body: string): string {
  return (
    `<!doctype html>\n` +
    `<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n` +
    `<title>${escape(title)}</title>\n` +
    `${fonts("print")}\n` +
    `</head>\n` +
    `<body style="margin:0;padding:0;background:${P.paper}">\n` +
    `<table ${TABLE} bgcolor="${P.paper}" style="background:${P.paper}">\n` +
    `<tr><td align="center" style="padding:20px 10px 32px">\n` +
    `<!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->\n` +
    `<table ${TABLE} style="max-width:640px;width:100%">\n` +
    `${body}\n` +
    `</table>\n` +
    `<!--[if mso]></td></tr></table><![endif]-->\n` +
    `</td></tr></table>\n` +
    `</body></html>`
  );
}
