// Generation schema for the replyCast family: what Claude fills via structured output.
// Maps the renderer draft (schema.ts) to friendly shapes: records -> {key,value} arrays (order kept),
// tuples/literal-unions -> objects and nullable enums. toDraft() rebuilds the draft and validates it.
import { z } from "zod";
import { schema, TONE_ORDER, type Draft } from "./schema";

const tone = z.enum(TONE_ORDER);

const toneOrNull = tone.nullable().describe("Tone, or null for none.");

const block = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("lead"),
    text: z.string().describe("Lead sentence, rendered as the first line of the reply."),
    url: z.string().optional().describe("Optional link attached to the lead."),
  }),
  z.strictObject({
    type: z.literal("tag"),
    text: z.string().describe("Short tag label."),
  }),
  z.strictObject({
    type: z.literal("urls"),
    title: z.string().describe("Heading for the list of links."),
    items: z
      .array(
        z.strictObject({
          key: z.string().describe("Link label."),
          value: z.string().describe("Link URL."),
        }),
      )
      .describe("Links in display order."),
    empty: z.string().optional().describe("Text shown when there are no items."),
  }),
  z.strictObject({ type: z.literal("h1"), text: z.string().describe("Large heading.") }),
  z.strictObject({ type: z.literal("h2"), text: z.string().describe("Section heading.") }),
  z.strictObject({ type: z.literal("h3"), text: z.string().describe("Sub-heading.") }),
  z.strictObject({ type: z.literal("p"), text: z.string().describe("Body paragraph.") }),
  z.strictObject({
    type: z.literal("shot"),
    path: z.string().describe("Screenshot path or source."),
    caption: z.string().optional().describe("Caption under the screenshot."),
  }),
  z.strictObject({
    type: z.literal("table"),
    head: z.array(z.string()).describe("Column headers. Columns 0-2 are #, When, What changed; extra columns need a header."),
    rows: z
      .array(z.array(z.string()).describe("Cells of one row. At least 3 cells."))
      .describe("Table rows."),
    highlight: z.array(z.number().int()).optional().describe("Row indexes to highlight (0-based)."),
    row_tones: z.array(toneOrNull).optional().describe("Per-row tone, one entry per row, or null."),
    tone: toneOrNull.optional().describe("Tone for the whole table, or null."),
    stamp: z.boolean().optional().describe("Show the stamp mark on the table."),
  }),
  z.strictObject({
    type: z.literal("tone"),
    tone: tone.describe("Callout tone: decides the colour of the block."),
    text: z.string().describe("Callout text."),
    icon: z.string().optional().describe("Optional icon character shown with the callout."),
  }),
]);

export const generationSchema = z.strictObject({
  slug: z.string().describe("Filename slug for the email, lowercase with hyphens."),
  subject: z.string().optional().describe("Email subject line."),
  greeting: z.string().optional().describe("Opening greeting line."),
  blocks: z.array(block).describe("Body blocks, rendered in order."),
  signoff: z.string().optional().describe("Sign-off line before the name, e.g. 'Best regards,' or empty."),
  name: z.string().optional().describe("Name shown under the sign-off."),
  after: z.array(block).optional().describe("Blocks rendered after the main body, in order."),
});

export type Generation = z.infer<typeof generationSchema>;
type GenBlock = Generation["blocks"][number];

function toDraftBlock(b: GenBlock): Draft["blocks"][number] {
  switch (b.type) {
    case "lead":
      return b.url !== undefined ? { lead: b.text, url: b.url } : { lead: b.text };
    case "tag":
      return { tag: b.text };
    case "urls": {
      // Ordered pairs, not an object: a JS object would move integer-like keys ("2026") to the front.
      const items: Array<[string, string]> = b.items.map(({ key, value }: { key: string; value: string }) => [key, value]);
      return { urls: { title: b.title, items, ...(b.empty !== undefined ? { empty: b.empty } : {}) } };
    }
    case "h1":
      return { h1: b.text };
    case "h2":
      return { h2: b.text };
    case "h3":
      return { h3: b.text };
    case "p":
      return { p: b.text };
    case "shot":
      return b.caption !== undefined ? { shot: b.path, caption: b.caption } : { shot: b.path };
    case "table": {
      const table: Record<string, unknown> = { head: b.head, rows: b.rows };
      if (b.highlight !== undefined) table.highlight = b.highlight;
      if (b.row_tones !== undefined) table.row_tones = b.row_tones.map((t) => t ?? "");
      if (b.tone !== undefined) table.tone = b.tone ?? "";
      if (b.stamp !== undefined) table.stamp = b.stamp;
      return { table } as Draft["blocks"][number];
    }
    case "tone": {
      const out: Record<string, string> = { [b.tone]: b.text };
      if (b.icon !== undefined) out.icon = b.icon;
      return out as Draft["blocks"][number];
    }
  }
}

/** Maps generation output to the renderer draft; the result is validated by the family schema. */
export function toDraft(out: unknown): Draft {
  const g = generationSchema.parse(out);
  const draft: Record<string, unknown> = { slug: g.slug, blocks: g.blocks.map(toDraftBlock) };
  if (g.subject !== undefined) draft.subject = g.subject;
  if (g.greeting !== undefined) draft.greeting = g.greeting;
  if (g.signoff !== undefined) draft.signoff = g.signoff;
  if (g.name !== undefined) draft.name = g.name;
  if (g.after !== undefined) draft.after = g.after.map(toDraftBlock);
  return schema.parse(draft);
}
