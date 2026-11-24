// Chat sessions: data/chats/<id>.json. Turns are append-only; only title/archived can change.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const CHATS_DIR = process.env.FORGE_CHATS_DIR ?? path.join(process.cwd(), "data/chats");
const ID_RE = /^c_[a-z0-9]{12}$/;

export interface Source {
  path: string;
  quote: string;
  /** The quote was found verbatim in the file (server-checked). */
  verified: boolean;
}

export interface Activity {
  tool: string;
  detail: string;
  error?: boolean;
}

export type Turn =
  | { id: string; at: string; role: "user"; text: string }
  | {
      id: string;
      at: string;
      role: "assistant";
      answer: string;
      sources: Source[];
      activity: Activity[];
      costUsd: number;
      durationMs: number;
      turns: number;
      model: string;
      backend: "cli" | "api";
      error?: string;
    };

/** A turn before the store stamps it (distributes over the union, so each role keeps its own fields). */
export type NewTurn = Turn extends infer T ? (T extends Turn ? Omit<T, "id" | "at"> & { id?: string; at?: string } : never) : never;

export interface ChatSession {
  id: string;
  title: string;
  created: string;
  updated: string;
  archived?: boolean;
  turns: Turn[];
}

export interface ChatSummary {
  id: string;
  title: string;
  updated: string;
  archived: boolean;
  turnCount: number;
  preview: string;
}

const newId = (p: string) => `${p}${randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "0").slice(0, 12)}`;

function file(id: string) {
  if (!ID_RE.test(id)) throw new Error("BAD_ID");
  return path.join(CHATS_DIR, `${id}.json`);
}

function save(s: ChatSession) {
  mkdirSync(CHATS_DIR, { recursive: true });
  const f = file(s.id);
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n");
  renameSync(tmp, f);
}

export function createChat(title?: string): ChatSession {
  const now = new Date().toISOString();
  const s: ChatSession = { id: newId("c_"), title: title?.trim().slice(0, 120) || "New chat", created: now, updated: now, turns: [] };
  save(s);
  return s;
}

export function getChat(id: string): ChatSession {
  const f = file(id);
  if (!existsSync(f)) throw new Error("NOT_FOUND");
  return JSON.parse(readFileSync(f, "utf8")) as ChatSession;
}

/** Appends a turn (never edits or removes existing ones). First user turn names an untitled chat. */
export function appendTurn(id: string, turn: NewTurn): Turn {
  const s = getChat(id);
  const t = { id: turn.id ?? newId("t_"), at: turn.at ?? new Date().toISOString(), ...turn } as Turn;
  s.turns.push(t);
  if (t.role === "user" && s.title === "New chat") s.title = t.text.replace(/\s+/g, " ").trim().slice(0, 80);
  s.updated = t.at;
  save(s);
  return t;
}

export function updateChat(id: string, patch: { title?: string; archived?: boolean }): ChatSession {
  const s = getChat(id);
  if (typeof patch.title === "string" && patch.title.trim()) s.title = patch.title.trim().slice(0, 120);
  if (typeof patch.archived === "boolean") s.archived = patch.archived;
  save(s);
  return s;
}

export function listChats(): ChatSummary[] {
  if (!existsSync(CHATS_DIR)) return [];
  const out: ChatSummary[] = [];
  for (const name of readdirSync(CHATS_DIR)) {
    if (!name.endsWith(".json")) continue;
    try {
      const s = JSON.parse(readFileSync(path.join(CHATS_DIR, name), "utf8")) as ChatSession;
      const last = [...s.turns].reverse().find((t) => t.role === "assistant") as Extract<Turn, { role: "assistant" }> | undefined;
      out.push({
        id: s.id,
        title: s.title,
        updated: s.updated,
        archived: !!s.archived,
        turnCount: s.turns.filter((t) => t.role === "user").length,
        preview: (last?.answer ?? "").replace(/\s+/g, " ").slice(0, 120),
      });
    } catch {
      /* skip unreadable */
    }
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated));
}
