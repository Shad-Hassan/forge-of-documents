// thread family: draft shape of ~/.claude/skills/replyCast/thread.py (a page of recorded replyCast messages).
// Two inputs: the thread spec as written on disk, and `files`, every file thread.py reads, keyed by the path
// exactly as the spec or bento JSON spells it. Text files hold their text; screenshots hold base64.
import { z } from "zod";

const sentEdit = z.tuple([z.string(), z.string()]);

const message = z
  .object({
    from: z.string(),
    email: z.string().optional(),
    channel: z.string().optional(),
    to: z.string().optional(),
    sent: z.string(),
    body: z.string().optional(),
    sent_edits: z.array(sentEdit).optional(),
    bento: z.string().optional(),
    shot: z.string().optional(),
    alt: z.string().optional(),
  })
  .passthrough();

export const specSchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    subject: z.string().optional(),
    messages: z.array(message),
  })
  .passthrough();

/** The bento JSON a message points at (tahmid-redflags-commentary.json shape). */
export const bentoSchema = z
  .object({
    dates: z.object({ first: z.string(), last: z.string(), disqualified: z.string() }),
    receipts: z.string(),
    title: z.string(),
    anecdote: z.string(),
    punchline: z.string(),
    specimen: z.array(z.tuple([z.string(), z.string()])),
    stats: z.array(z.object({ n: z.string(), label: z.string() })),
    intro: z.string(),
    notes_title: z.string(),
    notes: z.array(
      z.object({ when: z.string(), source: z.string(), quote: z.string(), kick: z.string() }),
    ),
    handling_title: z.string(),
    handling: z.string(),
    verdict: z.string(),
  })
  .passthrough();

export const inputSchema = specSchema.and(z.object({ files: z.record(z.string(), z.string()) }));

export type Spec = z.infer<typeof specSchema>;
export type ThreadInput = z.infer<typeof inputSchema>;
