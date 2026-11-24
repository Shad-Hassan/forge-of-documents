// Generation schema for the warden email family: what Claude fills via structured output.
// Hero facts [n,label] become {n,label} with n always a STRING, so "1.0" keeps its form.
import { z } from "zod";
import { schema, type Draft } from "./schema";
import { PILL_KINDS } from "./email";

const block = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("hero"),
    kicker: z.string().describe("Small label above the headline."),
    h1: z.string().describe("Hero headline."),
    lede: z.string().describe("Paragraph under the headline."),
    facts: z
      .array(
        z.strictObject({
          n: z.string().describe("Fact value as text, e.g. '12' or '1.0'. Always a string."),
          label: z.string().describe("Fact label."),
        }),
      )
      .describe("Fact tiles in display order."),
    extra: z.string().optional().describe("Optional raw HTML appended to the hero."),
  }),
  z.strictObject({
    type: z.literal("heading"),
    text: z.string().describe("Section heading."),
    intro: z.string().optional().describe("Intro paragraph under the heading."),
  }),
  z.strictObject({
    type: z.literal("text"),
    s: z.string().describe("Paragraph text."),
    size: z.number().optional().describe("Font size in px."),
    color: z.string().optional().describe("Text colour, hex."),
    weight: z.number().optional().describe("Font weight, e.g. 400 or 600."),
    pad: z.string().optional().describe("CSS padding, e.g. '6px 0 0'."),
  }),
  z.strictObject({
    type: z.literal("tile"),
    inner: z.string().describe("Tile content as HTML."),
    top: z.string().optional().describe("CSS top border, e.g. '2px solid #2C6488'."),
    pad: z.string().optional().describe("CSS padding."),
  }),
  z.strictObject({
    type: z.literal("pill"),
    kind: z.enum(PILL_KINDS).describe("Status pill kind."),
  }),
  z.strictObject({
    type: z.literal("links"),
    url: z.string().describe("Link target."),
    pdf_name: z.string().describe("Filename for the linked PDF."),
  }),
  z.strictObject({
    type: z.literal("raw"),
    text: z.string().describe("Raw HTML inserted as-is."),
    dark: z.boolean().optional().describe("Dark background variant."),
    tag: z.string().optional().describe("Tag label for the block."),
  }),
]);

export const generationSchema = z.strictObject({
  subject: z.string().describe("Email subject line."),
  preheader: z.string().optional().describe("Preheader text (not rendered by the shell)."),
  title: z.string().describe("Document title."),
  blocks: z.array(block).describe("Email blocks, rendered in order."),
});

export type Generation = z.infer<typeof generationSchema>;

/** Maps generation output to the renderer draft; the result is validated by the family schema. */
export function toDraft(out: unknown): Draft {
  const g = generationSchema.parse(out);
  const blocks = g.blocks.map((b) =>
    b.type === "hero" ? { ...b, facts: b.facts.map((f) => [f.n, f.label]) } : b,
  );
  return schema.parse({ ...g, blocks });
}
