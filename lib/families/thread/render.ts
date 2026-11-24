// Port of ~/.claude/skills/replyCast/thread.py: body_of, facts, bento, message, render.
// Pure: every file is read from `input.files`. Dates are calendar dates parsed as UTC (no local timezone).
import type { OutputKind } from "../../engine/types";
import { esc } from "../replycast/render";
import { CSS } from "./css";
import { FONT, HAIR, INK, NAVY, PAPER, SOFT } from "./tokens";
import { bentoSchema, type ThreadInput } from "./schema";

const BODY_RE = /<body[^>]*style="([^"]*)"[^>]*>([\s\S]*)<\/body>/;
const DAY_MS = 86400000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

type Files = Record<string, string>;

function fileText(files: Files, key: string): string {
  const v = files[key];
  if (v === undefined) throw new Error(`thread: file not supplied in input.files: ${key}`);
  return v;
}

/** Python datetime.strptime(s, "%Y-%m-%d").date(), as UTC midnight in ms. */
function isoDay(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`thread: bad date ${s}`);
  return checkedUtc(Number(m[1]), Number(m[2]), Number(m[3]), s);
}

function checkedUtc(y: number, mo: number, d: number, label: string): number {
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new Error(`thread: invalid calendar date ${label}`);
  }
  return t;
}

/** Python `(a - b).days` for two dates. */
const daysBetween = (a: number, b: number): number => Math.round((a - b) / DAY_MS);

/** Python str.format(**values) for the simple {name} fields the bento uses. */
function fmt(template: string, values: Record<string, number>): string {
  return template.replace(/\{\{|\}\}|\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (tok, name?: string) => {
    if (tok === "{{") return "{";
    if (tok === "}}") return "}";
    if (!(name! in values)) throw new Error(`thread: unknown format field {${name}}`);
    return String(values[name!]);
  });
}

function facts(bento: ReturnType<typeof bentoSchema.parse>, files: Files) {
  const first = isoDay(bento.dates.first);
  const last = isoDay(bento.dates.last);
  const disqualified = isoDay(bento.dates.disqualified);
  const year = new Date(first).getUTCFullYear();
  // "27/09" in the receipts table, dd/mm, in the year of the first sighting.
  const day = (s: string): number => {
    const m = /^(\d{1,2})\/(\d{1,2})$/.exec(s);
    if (!m) throw new Error(`thread: bad receipts date ${s}`);
    return checkedUtc(year, Number(m[2]), Number(m[1]), `${s}/${year}`);
  };
  const receipts = JSON.parse(fileText(files, bento.receipts)) as { blocks: Record<string, unknown>[] };
  const blockWithTable = receipts.blocks.find((b) => "table" in b);
  if (!blockWithTable) throw new Error("thread: receipts have no table block");
  const table = blockWithTable.table as { rows: string[][]; highlight: number[] };
  const hi = table.highlight;
  if (hi.length === 0) throw new Error("thread: receipts table has no highlight");
  return {
    days: daysBetween(last, first),
    since: daysBetween(last, disqualified),
    rewrites: hi.length,
    span: daysBetween(day(table.rows[hi[hi.length - 1]][1]), day(table.rows[0][1])),
  };
}

function bento(b: ReturnType<typeof bentoSchema.parse>, files: Files): string {
  const v = facts(b, files);
  const specRows = b.specimen.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("");
  const stats = b.stats
    .map(
      (s) =>
        `<div class="t s2"><p class="n">${esc(fmt(s.n, v))}</p><p class="l">${esc(fmt(s.label, v))}</p></div>`,
    )
    .join("");
  const notes = b.notes
    .map(
      (n, i) =>
        `<div class="t s2"><span class="ex" aria-hidden="true">${String.fromCharCode(65 + i)}</span>` +
        `<span class="pill">${esc(n.when)} · ${esc(n.source)}</span>` +
        `<p class="q">${esc(n.quote)}</p><p class="k">${esc(n.kick)}</p></div>`,
    )
    .join("");
  return `<div class="bx">
<h2 class="bx-h">${esc(b.title)}</h2>
<div class="t s4 hero"><span class="qm" aria-hidden="true">&ldquo;</span><p class="yarn">${esc(b.anecdote)}</p><p class="punch">${esc(b.punchline)}</p></div>
<div class="t s2 tagcard"><dl class="spec">${specRows}</dl></div>
${stats}
<p class="lead">${esc(b.intro)}</p>
<h3 class="bx-h3">${esc(b.notes_title)}</h3>
${notes}
<div class="t s4 hand"><h4>${esc(b.handling_title)}</h4><p>${esc(b.handling)}</p></div>
<div class="t s2 verdict"><span class="bang" aria-hidden="true">!</span><p>${esc(b.verdict)}</p></div>
</div>`;
}

/** Python body_of(): apply sent_edits (each must match exactly once), then keep the email's background and body. */
function bodyOf(files: Files, key: string, edits: [string, string][]): [string, string] {
  let src = fileText(files, key);
  for (const [saved, sent] of edits) {
    const n = src.split(saved).length - 1;
    if (n !== 1) throw new Error(`thread: sent_edit ${JSON.stringify(saved)} found ${n} times in ${key}, expected 1`);
    src = src.replace(saved, () => sent);
  }
  const m = BODY_RE.exec(src);
  if (!m) throw new Error(`thread: no <body> in ${key}`);
  const bg = m[1]
    .split(";")
    .filter((p) => p.trim().startsWith("background"))
    .join(";");
  return [bg, m[2].trim()];
}

/** Python datetime.strptime(s, "%b %d, %Y, %I:%M %p").isoformat(timespec="minutes"). */
function sentIso(s: string): string {
  const m = /^([A-Za-z]{3}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) ([AaPp][Mm])$/.exec(s);
  const mon = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || mon < 0) throw new Error(`thread: bad sent time ${s}`);
  const day = Number(m[2]);
  const year = Number(m[3]);
  let hour = Number(m[4]);
  if (hour < 1 || hour > 12) throw new Error(`thread: bad hour in ${s}`);
  const pm = m[6].toLowerCase() === "pm";
  hour = (hour % 12) + (pm ? 12 : 0);
  checkedUtc(year, mon + 1, day, s);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p2(mon + 1)}-${p2(day)}T${p2(hour)}:${p2(Number(m[5]))}`;
}

function message(m: ThreadInput["messages"][number], files: Files): string {
  let style = "";
  let inner: string;
  if (m.bento !== undefined) {
    inner = bento(bentoSchema.parse(JSON.parse(fileText(files, m.bento))), files);
  } else if (m.shot !== undefined) {
    const ext = /\.[^./\\]*$/.exec(m.shot)?.[0].toLowerCase() ?? "";
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    const alt = m.alt !== undefined ? m.alt : "Screenshot";
    inner = `<img src="data:${mime};base64,${fileText(files, m.shot)}" alt="${esc(alt)}">`;
  } else {
    if (m.body === undefined) throw new Error(`thread: message from ${m.from} has no body, bento or shot`);
    [style, inner] = bodyOf(files, m.body, m.sent_edits ?? []);
  }
  const addr = m.email ? `&lt;${esc(m.email)}&gt;` : esc(m.channel ?? "");
  const iso = sentIso(m.sent);
  const cls = m.shot !== undefined ? " shot" : m.bento !== undefined ? " bento" : "";
  const initial = (Array.from(m.from)[0] ?? "").toUpperCase();
  return `<article class="msg">
<header class="mh">
<div class="av" aria-hidden="true">${esc(initial)}</div>
<div>
<p class="who"><b>${esc(m.from)}</b> <span class="addr">${addr}</span></p>
${m.to ? `<p class="to">to ${esc(m.to)}</p>` : ""}
</div>
<p class="when"><time datetime="${iso}">${esc(m.sent)}</time></p>
</header>
<div class="mb${cls}" style="${style}">
${inner}
</div>
</article>`;
}

/** Port of thread.py render(): the page body (title, stylesheet, thread). Pure. */
export function renderThread(input: ThreadInput): string {
  const subj = input.subject ? `<h1 class="subj">${esc(input.subject)}</h1>` : "";
  const msgs = input.messages.map((m) => message(m, input.files)).join("\n");
  return `<title>${esc(input.title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="color-scheme" content="light only">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@700&family=IBM+Plex+Serif:ital,wght@1,400&display=swap">
<style>${CSS}</style>
<main class="wrap">
${subj}
${msgs}
</main>
`;
}

export function assertKind(kind: OutputKind): void {
  if (kind !== "email") throw new Error(`thread does not emit kind "${kind}" (it renders the .thread.html page as "email")`);
}
