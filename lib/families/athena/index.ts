// Athena family for the Claude Engine. Ports athena_base.py (tokens, paint, check) and the bento shell of
// build_athena_demo.py (web kind only). Output: one full HTML document, literal hex, no custom properties.
// render() is pure and refuses remote images; renderAsync() inlines https images with plexio's inliner.
import type { Family, OutputKind } from "../../engine/types";
import { inlineRemoteImages } from "../plexio/render";
import { ATHENA_CSS, FONTS, esc, paint } from "./base";
import { renderBlock } from "./blocks";
import { schema, type Draft } from "./schema";
import { generationSchema, toDraft } from "./generation";

export function renderDocument(input: Draft, allowRemote: boolean): string {
  const bento = input.blocks.map((b, i) => renderBlock(b, { allowRemote, index: i })).join("");
  return (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    `${FONTS}\n<title>${esc(input.title)}</title>\n<style>\n${paint(ATHENA_CSS)}</style>\n</head>\n<body>` +
    '<div class="shell">' +
    '<aside class="sidebar"><div class="brand">Athena<small>Command center</small></div></aside>' +
    '<div class="main">' +
    `<header class="topbar"><div class="crumb">${esc(input.title)}</div></header>` +
    `<main class="content"><div class="bento">${bento}</div></main>` +
    "</div></div></body>\n</html>\n"
  );
}

export const family: Family<typeof schema> = {
  id: "athena",
  portedFrom: ["athena_base.py", "build_athena_demo.py"],
  schema,
  generation: { schema: generationSchema, toDraft },
  kinds: ["web"],
  render(input, kind: OutputKind): string {
    if (kind !== "web") throw new Error(`athena: kind "${kind}" not supported (web only)`);
    return renderDocument(input, false);
  },
  async renderAsync(input, kind: OutputKind): Promise<string> {
    if (kind !== "web") throw new Error(`athena: kind "${kind}" not supported (web only)`);
    return inlineRemoteImages(renderDocument(input, true));
  },
};
