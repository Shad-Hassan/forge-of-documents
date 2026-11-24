// replyCast family: port of ~/.claude/skills/replyCast/build.py (email and paste output; build.py has no text output).
import type { Family } from "../../engine/types";
import { schema } from "./schema";
import { render as renderEmail, renderPaste } from "./render";
import { generationSchema, toDraft } from "./generation";

export const family: Family<typeof schema> = {
  id: "replycast",
  portedFrom: ["/home/shad/.claude/skills/replyCast/build.py"],
  schema,
  generation: { schema: generationSchema, toDraft },
  kinds: ["email", "paste"],
  render(input, kind) {
    if (kind === "email") return renderEmail(input);
    if (kind === "paste") return renderPaste(input);
    throw new Error(`replycast does not emit kind "${kind}"`);
  },
};
