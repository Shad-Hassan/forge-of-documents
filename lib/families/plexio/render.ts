// 1:1 port of build_note.py: render_html, render_text, artifact_page (and the helpers p, e).
// Python source: artifactHtml/src/build_note.py. Pure: no I/O, no clock.
import type { NoteDraft } from "./schema";

const F = "'IBM Plex Sans',Helvetica,Arial,sans-serif";
const TBL = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

/** Python html.escape(s, quote=True). */
export function e(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Python truthiness for the string/object fields this builder tests. */
function truthy(v: unknown): boolean {
  return Boolean(v);
}

/** Python round(x) for a float: round-half-to-even. */
function pyRound(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

interface PArgs {
  size?: number;
  weight?: number;
  color?: string;
  lh?: number;
  pad?: string;
  extra?: string;
  cls?: string;
}

export function p(text: string, a: PArgs = {}): string {
  const size = a.size ?? 16;
  const weight = a.weight ?? 400;
  const color = a.color ?? "#2B333A";
  const lh = a.lh ?? 1.65;
  const pad = a.pad ?? "0 0 16px";
  const extra = a.extra ?? "";
  const cls = a.cls ?? "";
  return (
    `<tr><td${cls ? ` class="${cls}"` : ""} style="font-family:${F};font-size:${size}px;font-weight:${weight};line-height:${lh};` +
    `color:${color};padding:${pad};${extra}">${text}</td></tr>`
  );
}

export function renderHtml(d: NoteDraft): string {
  let rows = d.context && truthy(d.context) ? p(e(d.context), { size: 13, color: "#7C868E", lh: 1.4, pad: "0 0 28px" }) : "";
  // Forge extension: an empty greeting/signature (forged answers) renders nothing. Python drafts always have both.
  if (d.greeting) rows += p(e(d.greeting), { color: "#161B20", pad: "0 0 14px" });
  rows += p(e(d.lead), {
    size: 24,
    weight: 700,
    color: "#161B20",
    lh: 1.25,
    pad: d.subtext ? "0 0 8px" : "0 0 20px",
    extra: "letter-spacing:-.4px",
    cls: "lead",
  });
  if (d.subtext) {
    rows += p(e(d.subtext), { size: 15, color: "#7C868E", lh: 1.5, pad: "0 0 24px" });
  }
  rows += (d.paragraphs ?? []).map((x) => p(e(x))).join("");

  const c = d.callout;
  if (c) {
    const body = c.paragraphs
      .map((x) => `<div style="font-family:${F};font-size:14.5px;line-height:1.6;color:#3F3A2B;padding-top:8px">${e(x)}</div>`)
      .join("");
    rows +=
      `<tr><td style="padding:0 0 24px"><table ${TBL} width="100%" style="border-collapse:separate"><tr>` +
      `<td bgcolor="#FFF8DF" style="background:#FFF8DF;border:1px solid #F1DD95;border-top:1px solid #FFFCEF;` +
      `border-radius:14px;padding:18px 20px 18px">` +
      `<table ${TBL}><tr><td bgcolor="#FBE8A6" style="background:#FBE8A6;border-radius:999px;padding:3px 10px;` +
      `font-family:${F};font-size:12px;font-weight:600;line-height:1.4;color:#6E5300">&#9679;&nbsp; ${e(c.eyebrow)}</td></tr></table>` +
      `${body}</td></tr></table></td></tr>`;
  }

  if (d.facts && d.facts.length > 0) {
    const fr = d.facts
      .map(
        ([k, v]) =>
          `<tr><td style="font-family:${F};font-size:14px;color:#7C868E;padding:10px 0;border-top:1px solid #DFE3E5">${e(k)}</td>` +
          `<td align="right" style="font-family:${F};font-size:14px;font-weight:600;color:#161B20;padding:10px 0;border-top:1px solid #DFE3E5">${e(v)}</td></tr>`,
      )
      .join("");
    rows += `<tr><td style="padding:4px 0 20px"><table ${TBL} width="100%">${fr}</table></td></tr>`;
  }

  rows += (d.after ?? []).map((x) => p(e(x))).join("");

  const im = d.image;
  if (im) {
    const w = 512;
    const h = pyRound((w * im.height) / im.width);
    let tag =
      `<img src="${e(im.url)}" width="${w}" height="${h}" alt="${e(im.alt)}" ` +
      `style="display:block;width:100%;max-width:${w}px;height:auto;border:1px solid #DFE3E5;border-radius:12px">`;
    if (im.link) tag = `<a href="${e(im.link)}" style="text-decoration:none">${tag}</a>`;
    rows += `<tr><td style="padding:0 0 ${im.caption ? 10 : 24}px">${tag}</td></tr>`;
    if (im.caption) rows += p(e(im.caption), { size: 13, color: "#7C868E", lh: 1.45, pad: "0 0 24px" });
  }

  const b = d.button;
  if (b) {
    const shown = b.url.replace(/^https?:\/\//, "");
    rows += p(
      `${e(b.label)}: <a href="${e(b.url)}" style="color:#0071E3;font-weight:600;text-decoration:none;` +
        `word-break:normal;overflow-wrap:anywhere;word-wrap:break-word"><span style="color:#0071E3">${shown
          .split("/")
          .map((x) => e(x))
          .join("/<wbr>")}</span></a>`,
      { pad: "0 0 24px" },
    );
  }

  const pg = d.progress;
  if (pg) {
    const TONE: Record<string, [string, string]> = {
      done: ["#E2F2E9", "#1F7A4D"],
      active: ["#FFF3CF", "#6E5300"],
      target: ["#E6EDF4", "#2E4A66"],
    };
    let pr = "";
    pg.rows.forEach(([label, value, tone], i) => {
      const [bg, fg] = TONE[tone];
      const line = i === 0 ? "" : "border-top:1px solid #E1E7EC;";
      pr +=
        `<tr><td style="font-family:${F};font-size:14px;line-height:1.4;color:#2B333A;padding:11px 12px 11px 0;${line}">${e(label)}</td>` +
        `<td align="right" valign="middle" style="padding:9px 0;${line}white-space:nowrap">` +
        `<span style="display:inline-block;background:${bg};color:${fg};border-radius:999px;padding:3px 10px;` +
        `font-family:${F};font-size:12.5px;font-weight:600;line-height:1.4;white-space:nowrap">${e(value)}</span></td></tr>`;
    });
    rows +=
      `<tr><td style="padding:4px 0 24px"><table ${TBL} width="100%" style="border-collapse:separate"><tr>` +
      `<td bgcolor="#F4F7FA" style="background:#F4F7FA;border:1px solid #DCE4EA;border-top:1px solid #FFFFFF;border-radius:14px;padding:16px 18px 10px">` +
      `<table ${TBL}><tr><td bgcolor="#E6EDF4" style="background:#E6EDF4;border-radius:999px;padding:3px 10px;` +
      `font-family:${F};font-size:12px;font-weight:600;line-height:1.4;color:#2E4A66">&#9679;&nbsp; ${e(pg.title ?? "Progress")}</td></tr></table>` +
      `<table ${TBL} width="100%" style="margin-top:8px">${pr}</table></td></tr></table></td></tr>`;
  }

  if (d.closing) {
    rows += p(e(d.closing), { pad: d.closing.endsWith(",") ? "0 0 4px" : "0 0 24px" });
  }
  if (d.signature) rows += p(e(d.signature), { weight: 600, color: "#161B20", pad: "0" });

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><title>${e(d.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{margin:0;padding:0;background:#F1F3F4} table{border-collapse:collapse} a{color:#2E4A66} img{max-width:100%;height:auto}
@media (max-width:480px){ .card{padding:24px 18px !important} .lead{font-size:21px !important} }</style>
</head><body style="margin:0;padding:0;background:#F1F3F4">
<table ${TBL} width="100%" bgcolor="#F1F3F4" style="background:#F1F3F4"><tr><td align="center" style="padding:20px 8px">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table ${TBL} width="100%" style="max-width:600px;margin:0 auto"><tr><td class="card" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:18px;padding:32px 28px">
<table ${TBL} width="100%">${rows}</table>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

export function renderText(d: NoteDraft): string {
  const parts: string[] = [
    ...(d.greeting ? [d.greeting] : []),
    d.lead + (d.subtext ? `\n${d.subtext}` : ""),
    ...(d.paragraphs ?? []),
  ];
  if (d.callout) {
    parts.push(`${d.callout.eyebrow}:\n` + d.callout.paragraphs.join("\n"));
  }
  if (d.facts && d.facts.length > 0) {
    parts.push(d.facts.map(([k, v]) => `${k}: ${v}`).join("\n"));
  }
  parts.push(...(d.after ?? []));
  const b = d.button;
  if (b) parts.push(`${b.label}: ${b.url}`);
  if (d.progress) {
    const pg = d.progress;
    parts.push(`${pg.title ?? "Progress"}:\n` + pg.rows.map(([l, v]) => `${l}: ${v}`).join("\n"));
  }
  const closing = d.closing ?? "";
  if (closing.endsWith(",")) {
    parts.push(d.signature ? `${closing}\n${d.signature}` : closing);
  } else {
    parts.push(...[d.closing, d.signature].filter((x): x is string => truthy(x)));
  }
  return parts.join("\n\n") + "\n";
}

/**
 * Port of artifact_page(). The Python version downloads every remote <img> and inlines it as a
 * data URI. That is network I/O, which this pure render does not do, so a remote image throws
 * instead of silently emitting a page the viewer will not display.
 */
export function artifactPage(h: string, d: NoteDraft, opts: { allowRemote?: boolean } = {}): string {
  let out = h.replace(/<!DOCTYPE html>\s*|<\/?html[^>]*>|<\/?head>|<meta[^>]*>|<\/?body[^>]*>/g, "");
  out = out.replace(/<title>.*?<\/title>/, () => `<title>${e(d.title ?? d.subject)}</title>`);
  if (!opts.allowRemote && /<img src="(https?:\/\/[^"]+)"/.test(out)) {
    throw new Error("plexio web: remote <img> needs inlining (network I/O); use family.renderAsync");
  }
  return out.trim();
}

/**
 * The network half of artifact_page(): every distinct remote <img src> becomes a data URI.
 * Mirrors Python exactly: urlopen(url, timeout=30), base64, and the literal "image/png" MIME.
 */
export async function inlineRemoteImages(html: string, fetcher: typeof fetch = fetch): Promise<string> {
  const urls = [...new Set([...html.matchAll(/<img src="(https?:\/\/[^"]+)"/g)].map((m) => m[1]))];
  let out = html;
  for (const url of urls) {
    const res = await fetcher(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`plexio web: image fetch ${res.status} for ${url}`);
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    out = out.split(`src="${url}"`).join(`src="data:image/png;base64,${b64}"`);
  }
  return out;
}
