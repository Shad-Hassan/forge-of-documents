// Warden family for the Claude Engine. Ports warden_email.py (email kind only).
import type { Family, OutputKind } from "../../engine/types";
import { schema, type Draft } from "./schema";
import { hero, heading, links, pill, raw, shell, tile, text } from "./email";
import { generationSchema, toDraft } from "./generation";

type Block = Draft["blocks"][number];

function renderBlock(b: Block): string {
  switch (b.type) {
    case "hero":
      return hero(b.kicker, b.h1, b.lede, b.facts, b.extra);
    case "heading":
      return heading(b.text, b.intro);
    case "text":
      return text(b.s, b.size, b.color, b.weight, b.pad);
    case "tile":
      return tile(b.inner, b.top, b.pad);
    case "pill":
      return pill(b.kind);
    case "links":
      return links(b.url, b.pdf_name);
    case "raw":
      return raw(b.text, b.dark, b.tag);
    default: {
      const never: never = b;
      throw new Error(`unknown block ${JSON.stringify(never)}`);
    }
  }
}

export const family: Family<typeof schema> = {
  id: "warden",
  portedFrom: ["warden_base.py", "warden_email.py"],
  schema,
  generation: { schema: generationSchema, toDraft },
  kinds: ["email"],
  render(input, kind: OutputKind): string {
    if (kind !== "email") throw new Error(`warden: kind "${kind}" not supported (email only)`);
    // Builders concatenate their rows with no separator (build_claude_os_erp.py, build_icecrown_citadel.py).
    const body = input.blocks.map(renderBlock).join("");
    return shell(input.title, body);
  },
};
