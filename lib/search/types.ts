// Search contract: the read-only tools Claude uses to search the artifact universe.
// lib/search/index.ts implements these. app/api/ask maps them to Anthropic search_result blocks.

/** Allowlisted roots, by name. Every path a tool touches must resolve (realpath) inside one of these. */
export type RootName = "artifacts" | "uploads";

export interface Snippet {
  /** 1-based line number of the matching line. */
  line: number;
  /** The matching line plus up to 2 lines of context either side, joined by "\n". Max 600 chars. */
  text: string;
}

export interface FileHit {
  /** Path relative to its root, POSIX separators, e.g. "drafts/rentcast-invoice-nasir.json". */
  path: string;
  root: RootName;
  /** From the sibling .meta.json `title` when present, else the file name. */
  title: string;
  /** At most 5 per file, in line order. */
  snippets: Snippet[];
}

export interface SearchArgs {
  /** Case-insensitive. Treated as a fixed string unless regex is true. */
  pattern: string;
  /** Optional glob filter, e.g. "*.json" or "drafts/**". */
  glob?: string;
  /** Max files returned. Default 20, hard cap 50. */
  limit?: number;
  regex?: boolean;
  /** Default: both roots. */
  roots?: RootName[];
}

export interface ReadArgs {
  /** "<root>:<relative path>", e.g. "artifacts:INDEX.md". */
  path: string;
  /** 1-based inclusive line range. Default 1..400. Max span 800 lines. */
  from?: number;
  to?: number;
}

export interface ReadResult {
  path: string;
  root: RootName;
  title: string;
  /** Plain text: HTML has tags stripped with headings kept as "# ...", PDF via pdftotext, DOCX via its .txt sidecar. */
  text: string;
  from: number;
  to: number;
  totalLines: number;
}

export interface ListEntry {
  path: string;
  root: RootName;
  bytes: number;
  title?: string;
  style?: string;
  generation?: number;
  audience?: string;
}

export interface ListArgs {
  /** "<root>:<relative dir>", default "artifacts:". */
  dir?: string;
  /** Max entries. Default 200. */
  limit?: number;
}
