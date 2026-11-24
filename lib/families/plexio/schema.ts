// Draft JSON shape consumed by build_note.py (plexio note mode).
// Everything except subject, greeting, lead and signature is optional.
import { z } from "zod";

export const schema = z.object({
  subject: z.string(),
  to: z.string().optional(),
  title: z.string().optional(),
  greeting: z.string(),
  lead: z.string(),
  context: z.string().optional(),
  subtext: z.string().optional(),
  paragraphs: z.array(z.string()).optional(),
  callout: z
    .object({
      eyebrow: z.string(),
      paragraphs: z.array(z.string()),
    })
    .optional(),
  facts: z.array(z.tuple([z.string(), z.string()])).optional(),
  image: z
    .object({
      url: z.string(),
      width: z.number(),
      height: z.number(),
      alt: z.string(),
      link: z.string().optional(),
      caption: z.string().optional(),
    })
    .optional(),
  button: z
    .object({
      label: z.string(),
      url: z.string(),
    })
    .optional(),
  progress: z
    .object({
      title: z.string().optional(),
      rows: z.array(
        z.tuple([
          z.string(),
          z.string(),
          z.enum(["done", "active", "target"]),
        ]),
      ),
    })
    .optional(),
  after: z.array(z.string()).optional(),
  closing: z.string().optional(),
  signature: z.string(),
});

export type NoteDraft = z.infer<typeof schema>;
