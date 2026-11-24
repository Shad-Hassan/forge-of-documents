// Bento block renderer for the athena web kind. Plain fields go through esc(); rich fields through rich()
// (escape first, then **bold** and `code`). Every colour is a class in ATHENA_CSS or a token inside flow.ts.
import { esc, rich } from "./base";
import { flowSvg } from "./flow";
import type { Block } from "./schema";

export interface BlockCtx {
  /** false for render(): a remote https image throws. true for renderAsync(): it is inlined afterwards. */
  allowRemote: boolean;
  /** position in the page, used to give each flow SVG a unique id. */
  index: number;
}

const SPAN_CLASS: Record<string, string> = { "1": "span-4", "2": "span-8", "3": "span-12" };
const TONE_LABEL: Record<string, string> = { info: "Info", warn: "Warning", ok: "OK" };
const STATUS_LABEL: Record<string, string> = { ok: "OK", warn: "Watch", risk: "Critical" };

function header(b: Extract<Block, { type: "header" }>): string {
  return (
    `<section class="head">` +
    (b.eyebrow ? `<p class="eyebrow">${esc(b.eyebrow)}</p>` : "") +
    `<h1>${esc(b.title)}</h1>` +
    (b.lede ? `<p class="lede">${rich(b.lede)}</p>` : "") +
    `</section>`
  );
}

function stats(b: Extract<Block, { type: "stats" }>): string {
  return b.items
    .map(
      (i) =>
        `<article class="tile span-3"><p class="label">${esc(i.label)}</p>` +
        `<div class="num">${esc(i.value)}</div>` +
        (i.note ? `<p class="note">${rich(i.note)}</p>` : "") +
        `</article>`,
    )
    .join("");
}

function section(b: Extract<Block, { type: "section" }>): string {
  return `<h2 class="section">${esc(b.title)}</h2>`;
}

function tile(b: Extract<Block, { type: "tile" }>): string {
  const span = SPAN_CLASS[b.span ?? "3"];
  const body = b.body.map((p) => `<p>${rich(p)}</p>`).join("");
  const list = b.list && b.list.length ? `<ul class="plain">${b.list.map((li) => `<li>${rich(li)}</li>`).join("")}</ul>` : "";
  return `<article class="tile ${span}">${b.title ? `<h3>${esc(b.title)}</h3>` : ""}${body}${list}</article>`;
}

function image(b: Extract<Block, { type: "image" }>, ctx: BlockCtx): string {
  if (!ctx.allowRemote && b.src.startsWith("https://")) {
    throw new Error("athena: image src is remote (https); render() cannot inline it, use renderAsync()");
  }
  const span = SPAN_CLASS[b.span ?? "3"];
  return (
    `<figure class="tile fig ${span}"><img src="${esc(b.src)}" alt="${esc(b.alt)}">` +
    (b.caption ? `<figcaption>${rich(b.caption)}</figcaption>` : "") +
    `</figure>`
  );
}

function flow(b: Extract<Block, { type: "flow" }>, ctx: BlockCtx): string {
  return (
    `<article class="tile span-12 flow">` +
    (b.title ? `<h3>${esc(b.title)}</h3>` : "") +
    `<div class="flow-wrap">${flowSvg(b, `athena-flow-${ctx.index}`)}</div></article>`
  );
}

function table(b: Extract<Block, { type: "table" }>): string {
  const head = `<tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  const rows = b.rows.map((r) => `<tr>${r.map((c) => `<td>${rich(c)}</td>`).join("")}</tr>`).join("");
  return `<article class="tile span-12"><div class="tbl"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div></article>`;
}

function list(b: Extract<Block, { type: "list" }>): string {
  const rows = b.items
    .map((i) => {
      if (!i.status) return `<li class="row plain-row"><span class="name">${rich(i.text)}</span></li>`;
      return (
        `<li class="row"><span class="dot ${i.status}"></span>` +
        `<span class="name">${rich(i.text)}</span>` +
        `<span class="meta">${esc(STATUS_LABEL[i.status])}</span></li>`
      );
    })
    .join("");
  return `<article class="tile span-4"><ul class="list">${rows}</ul></article>`;
}

function callout(b: Extract<Block, { type: "callout" }>): string {
  return (
    `<article class="tile span-12 callout ${b.tone}">` +
    `<p class="label">${esc(TONE_LABEL[b.tone])}</p>` +
    `<p>${rich(b.text)}</p></article>`
  );
}

function seal(b: Extract<Block, { type: "seal" }>): string {
  return (
    `<footer class="tile span-12 seal">` +
    `<p>Sealed by ${esc(b.who)}</p>` +
    `<p>Source: ${esc(b.source)}</p>` +
    `<p>${esc(b.date)} · version ${esc(b.version)}</p></footer>`
  );
}

export function renderBlock(b: Block, ctx: BlockCtx): string {
  switch (b.type) {
    case "header":
      return header(b);
    case "stats":
      return stats(b);
    case "section":
      return section(b);
    case "tile":
      return tile(b);
    case "image":
      return image(b, ctx);
    case "flow":
      return flow(b, ctx);
    case "table":
      return table(b);
    case "list":
      return list(b);
    case "callout":
      return callout(b);
    case "seal":
      return seal(b);
    default: {
      const never: never = b;
      throw new Error(`athena: unknown block ${JSON.stringify(never)}`);
    }
  }
}
