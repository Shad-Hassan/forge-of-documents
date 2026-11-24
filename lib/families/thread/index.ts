// thread renderer: port of ~/.claude/skills/replyCast/thread.py (a page of recorded replyCast messages).
// Not a doc-store Family: no generation schema (it renders recorded threads, not Claude output), and
// its input is a spec PATH whose sibling files are loaded. CLI: `forge-render thread <spec.json>`.
// check() (screenshots) is not ported.
import { inputSchema } from "./schema";
import { renderThread } from "./render";
import { loadThreadInput } from "./load";

export const thread = {
  id: "thread" as const,
  portedFrom: ["/home/shad/.claude/skills/replyCast/thread.py"],
  schema: inputSchema,
  /** thread.py writes <slug>.thread.html. */
  ext: ".thread.html",
  /** Pure: input must already contain every file in `files`. */
  render: (input: unknown) => renderThread(inputSchema.parse(input)),
  /** Loads the spec and the files it references (relative to the spec's folder), then renders. */
  renderFile: async (specPath: string) => renderThread(await loadThreadInput(specPath)),
};
