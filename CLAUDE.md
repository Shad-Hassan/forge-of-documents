---
title: Forge of Documents II — app
aliases: [Forge app, Engine of Artifact]
tags: [forge, claude-code, nextjs, rag, artifacts, editor]
updated: 2026-11-24
plan: ../designRules/FORGE-SAAS-PLAN.md
design: ../designRules/ui-ux-benchmark.md
---

# Forge of Documents II

Shad's private **Engine of Artifact** and the **one renderer** for his artifact families. One user, local only.
Ask the artifact universe → cited answer → forge a versioned document → edit it live → render it everywhere.

> [!important] One renderer
> TypeScript in `lib/families/` is the only renderer. The skills' Python builders are shims that call `forge.sh render` (cutover 2026-11-24, proven byte-identical on every real draft). The frozen originals are `*_legacy.py`, read-only. **Change a look here, never in Python.**

## Run

```bash
../forge.sh                    # dev server, checks deps + key, prints URLs (--open, PORT=3100)
../forge.sh render <family> <draft.json> [--kinds …] [--out dir] [--name stem] [--eml] [--check]
forge-document                 # same launcher from anywhere (~/.local/bin wrapper)
npm run build                  # must pass before claiming done
```

UI: `/chat` (premium thread + session catalog) · `/engine` (Ask · Library · Documents · Forge) · `/engine/docs/<id>` (editor) · **`/status` (2-minute read: what this is, what's done, where it stands, the benchmark; source `docs/STATUS.md`)** · `/` (original generator).

**Backend** (`lib/engine/backend.ts`): `FORGE_BACKEND=auto|api|cli`. `auto` = API when the key looks real, else **headless Claude Code on Shad's login** (`lib/cli/claude.ts`). Today: cli (the `.env.local` key is an 11-char stub). Personal, local use only.

## Flow

```
question ─► router ─► search loop ─► cited answer ─► forge ─► doc v1 ─► edit / revise ─► v2, v3 …
            rules→Haiku  Opus + grep    search_result   strict schema   draft.json + outputs + note
```

| Stage | Where | Notes |
|---|---|---|
| Router | `lib/ask/router.ts` | Regex fast path (0 tokens), then `claude-haiku-5-5` structured output |
| Search loop | `app/api/ask`, `lib/ask/tools.ts` | Tool Runner, `claude-opus-5-5`, `search`/`read`/`list` over `lib/search` |
| Forge | `app/api/forge`, `lib/forge/forge.ts` | `messages.parse` + family generation schema → `createDoc` |
| Store | `lib/docs/store.ts` | `data/out/<id>/doc.json` + immutable `v<n>/` (draft, outputs, note). **Append-only** |
| Edit | `PUT /api/docs/<id>` | Validate → re-render → new version. $0, no Claude |
| Revise | `POST /api/docs/<id>/revise` | Claude proposes a draft; the editor shows a diff; Accept → PUT |
| Editor | `components/engine/DocEditor.tsx` | Live preview rendered **in the browser** by the same TS renderers |
| Chat | `/chat`, `lib/chat/{store,ask}.ts`, `app/api/chat/**` | `data/chats/<id>.json` (append-only turns), SSE stream: user → activity → done; quotes verified against files; Stop kills the CLI process group |
| Status | `/status`, `docs/STATUS.md`, `components/status/ObsidianNote.tsx` | Obsidian note rendered as-is, plus live counters. **Update STATUS.md when things change** |

## Routes and pages

| Route | Does |
|---|---|
| `/chat` · `/engine` · `/engine/docs/<id>` · `/status` · `/` | Chat · engine · editor · status · original generator |
| `POST /api/chat` · `GET /api/chat` | New session · catalog (+ backend status) |
| `GET/PATCH /api/chat/<id>` · `POST /api/chat/<id>/message` | Thread, rename/archive · send (SSE: user, activity, thinking, done, error) |
| `POST /api/ask` | One-off cited answer (API: Tool Runner; cli: same engine as chat) |
| `POST /api/forge` | Answer → versioned doc (both backends) |
| `GET /api/docs` · `GET/PUT /api/docs/<id>` · `POST /api/docs/<id>/revise` | List · read/save version · Claude proposal |
| `POST /api/upload` · `GET/DELETE /api/library` | Uploads into `data/uploads` · list/delete |
| `GET /api/out?path=` | Read-only, sandboxed (CSP) preview of `data/out` files; escapes → 403 |
| `POST /api/generate` | The original one-shot generator behind `/` (`lib/templates/`, API only) |

Runtime data (gitignored): `data/uploads/` · `data/out/<id>/` (docs) · `data/chats/` · `data/textcache/` (PDF text for grep).

## Families (renderers)

| Id | Ports (frozen original) | Kinds | Skill |
|---|---|---|---|
| `replycast` | `replyCast/build_legacy.py` | email, paste | /replyCast |
| `plexio` | `artifactHtml/src/build_note_legacy.py` | email, text, web (+ `.eml` alternative) | /plexio note mode |
| `warden` | `warden_base.py` + `warden_email.py` | email (block draft) | /warden email |
| `athena` | `athena_base.py` (frozen) | web (bento blocks, Gen 3) | /athena |
| `thread` (CLI only) | `replyCast/thread_legacy.py` | `.thread.html` | /replyCast hard mode |

Each family: `schema.ts` (renderer contract = Python draft shape), `render.ts`, `generation.ts` (strict Claude-facing schema + `toDraft`), `index.ts`. Registry: `lib/families/index.ts`. Visual primitives: `lib/visuals/` (flowmode, warden_flow, citadel).

**Add a family:** folder + register in `lib/families/index.ts` + id in `FamilyId` (`lib/engine/types.ts`) + goldens + an output rule in `scripts/forge-render.ts` (the CLI behind `forge.sh render`).

## Receipts (no API calls)

```bash
npx tsx scripts/golden.ts <family> <kind> <draft.json> <expected>   # TS vs Python output
npx tsx scripts/drift.ts                 # every real draft vs golden/drift/expected (57/57)
python3 -I scripts/drift-regen.py         # rebuild that expected set from the FROZEN *_legacy.py (never the shims)
npx tsx scripts/threadcheck.ts            # threads (2/2)
npx tsx scripts/gencheck.ts               # generation round-trips (9)
npx tsx scripts/schemacheck.ts            # schemas → structured output (4/4)
npx tsx scripts/forgecheck.ts             # forge + store: v1, v2, v1 immutable, rejects
npx tsx scripts/tokencheck.ts [athena|warden]   # contrast (== Python --check)
npx tsx lib/visuals/golden.ts             # 128 SVG cases
npx tsx lib/search/selftest.ts && npx tsx lib/uploads/selftest.ts
npx tsc --noEmit -p . && npm run build
```

## Env

| Var | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Ask, Forge, Revise |
| `FORGE_EML_FROM` | Enables `.eml` (nothing hardcoded in the app; the build_note shim sets it) |
| `FORGE_OBSIDIAN_DIR` | Copies each version's `.md` note into that vault folder |
| `FORGE_BACKEND` | `auto` (default) · `api` · `cli` |
| `FORGE_CHAT_MODEL` | Chat model (default `claude-opus-5-5`; tests use `claude-haiku-5-5`) |
| `FORGE_CLAUDE_BIN` · `FORGE_CHATS_DIR` | CLI path override · chat store path (tests) |
| `FORGE_ARTIFACTS_ROOT` · `FORGE_UPLOADS_ROOT` · `FORGE_OUT_DIR` · `FORGE_TEXTCACHE` | Path overrides (tests use them) |

## Rules that bite

- **Shad's words are the content.** Renderers and fixtures never add labels, titles, emphasis or text the source lacks.
- **Evidence:** versions are immutable; client-facing docs show a notice; never overwrite a `v<n>/`.
- **Renderers are pure** (no I/O, clock, randomness). I/O lives in `renderAsync`, `load.ts` or the store.
- **No `export const runtime`** (cacheComponents rejects it); dynamic pages read `params` inside `<Suspense>`.
- **Routes live in `app/api/`.** Dynamic route params: `{ params: Promise<{ id: string }> }`.
- **Forced `tool_choice` returns 400 on `claude-opus-5-5`:** use `messages.parse` + `zodOutputFormat`. Citations and `output_config.format` can't share a request.
- **Strict schemas:** no `z.record`/`z.tuple`/`z.any`/`.passthrough()` in `generation.ts`; `.min()` only 0 or 1.
- **Scripts need module scope** (`export {}` or an import), or their `main()` collide.
- **`forge-render` output dirs:** replycast and Forge-native families write beside the draft; only plexio writes to the fixed `artifactHtml/drafts`. Test with `--out <scratch>`.
- **Headless CLI isolation:** `--setting-sources ""` + own `--system-prompt` + `--strict-mcp-config` + `--disable-slash-commands` + `--no-session-persistence` + `--tools Read,Grep,Glob` + `--permission-mode dontAsk` + `--restricted`. Never `--bare` (it ignores the OAuth login). Never `--resume` (it writes into `~/.claude/projects`).
- **Never invent greetings, closings, signatures or seals:** generation schemas make them optional, and the prompts forbid them.
- **`grep`/`rg` in Claude Code's shell are wrappers.** The app calls `/usr/bin/grep` (GNU 3.11) by path.
- **Contrast floor 4.5:1.** Ivory on bronze = 3.31:1 (fails); use void-900 on bronze-600 (5.13:1).
- **artifactHtml is read-only** for tests. Never run a `build_*.py` in place.

## Still Python (not ported yet)

plexio hard mode (`hard_mode.py`, Synergy Universe skin, `hero_blackhole.py`), plexio `survey-report` / `thread-record` / hard flowmode web, and warden cosmic web + print (`warden_base.py`, `warden_world.py`). The warden tokens exist in both languages: after a token change, run both checks.

## Known gaps

- PDF printing is blocked by AppArmor (`apparmor_restrict_unprivileged_userns=1`). Needs Shad's call.
- API-path receipts for Ask, Forge and Revise wait on credits (the CLI path is verified live: chat, follow-up, escape denied, Stop, forge).
- athena template chrome (sidebar brand, topbar title, callout tone labels) awaits Shad's call.
