// Generation schema for the plexio note family: what Claude fills via structured output.
// Tuples become {label,value} objects; the progress tone enum is fixed to done|active|target.
import { z } from "zod";
import { schema, type NoteDraft } from "./schema";

export const generationSchema = z.strictObject({
  subject: z.string().describe("Email subject line."),
  to: z.string().optional().describe("Recipient name or address, if shown."),
  title: z.string().optional().describe("Page title for the web version. Defaults to the subject."),
  greeting: z.string().optional().describe("Opening greeting, e.g. 'Hello Nasir,'. Only if the source contains one; never invent a greeting."),
  lead: z.string().describe("Large headline sentence under the greeting."),
  context: z.string().optional().describe("Small grey line above the greeting."),
  subtext: z.string().optional().describe("Grey supporting sentence under the lead."),
  paragraphs: z.array(z.string()).optional().describe("Body paragraphs, in order."),
  callout: z
    .strictObject({
      eyebrow: z.string().describe("Short label on the callout pill."),
      paragraphs: z.array(z.string()).describe("Callout body paragraphs."),
    })
    .optional()
    .describe("Highlighted yellow box."),
  facts: z
    .array(
      z.strictObject({
        label: z.string().describe("Fact name, left column."),
        value: z.string().describe("Fact value, right column."),
      }),
    )
    .optional()
    .describe("Key/value rows, in display order."),
  image: z
    .strictObject({
      url: z.string().describe("Image URL."),
      width: z.number().describe("Original image width in pixels."),
      height: z.number().describe("Original image height in pixels."),
      alt: z.string().describe("Alt text."),
      link: z.string().optional().describe("Optional link when the image is clicked."),
      caption: z.string().optional().describe("Caption under the image."),
    })
    .optional()
    .describe("One image."),
  button: z
    .strictObject({
      label: z.string().describe("Link label shown before the URL."),
      url: z.string().describe("Link target."),
    })
    .optional()
    .describe("One call-to-action link."),
  progress: z
    .strictObject({
      title: z.string().optional().describe("Panel title. Defaults to 'Progress'."),
      rows: z
        .array(
          z.strictObject({
            label: z.string().describe("Workstream name."),
            value: z.string().describe("Status text shown in the pill."),
            tone: z.enum(["done", "active", "target"]).describe("done = finished, active = in progress, target = future goal."),
          }),
        )
        .describe("Progress rows, in order."),
    })
    .optional()
    .describe("Progress panel with status pills."),
  after: z.array(z.string()).optional().describe("Paragraphs after the main body, in order."),
  closing: z.string().optional().describe("Closing line, e.g. 'Best regards,'. Ends with a comma puts the signature on its own line."),
  signature: z.string().optional().describe("Name under the closing. Only if the source contains a sign-off; never invent one."),
});

export type Generation = z.infer<typeof generationSchema>;

/** Maps generation output to the renderer draft; the result is validated by the family schema. */
export function toDraft(out: unknown): NoteDraft {
  const g = generationSchema.parse(out);
  const draft: Record<string, unknown> = { ...g, greeting: g.greeting ?? "", signature: g.signature ?? "" };
  if (g.facts !== undefined) draft.facts = g.facts.map((f) => [f.label, f.value]);
  if (g.progress !== undefined) {
    draft.progress = {
      ...(g.progress.title !== undefined ? { title: g.progress.title } : {}),
      rows: g.progress.rows.map((r) => [r.label, r.value, r.tone]),
    };
  }
  return schema.parse(draft);
}
