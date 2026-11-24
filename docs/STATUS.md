---
title: Forge of Documents II — status
aliases: [Forge status, Engine of Artifact status]
tags: [forge, status, benchmark, artifacts]
updated: 2026-11-24
stage: renderer cutover done · chat live · API credits pending
owner: Shad
route: /status
---

# Forge of Documents II

> [!summary] What this is, in one breath
> Shad's private **Engine of Artifact**: ask the artifact universe, get a cited answer, forge it into a versioned document in any family, edit it live, render it everywhere. It is also **the one renderer** for every artifact skill: the Python builders became shims, proven byte-identical.

## How it works

| Step | What happens | Where |
|---|---|---|
| Ask | Claude searches the library read-only (Grep / Read), answers, and cites. Every quote is checked against the file | `/chat`, `/engine` |
| Forge | The answer is filled into a family's strict schema, then rendered to web, email, text, `.eml` and a note | `lib/forge`, `lib/families` |
| Store | Each document is `doc.json` plus immutable `v1/`, `v2/`… (append-only = evidence) | `data/out/<id>/` |
| Edit | JSON editor with a live in-browser preview, a version rail with diffs, and Claude revise with accept/discard | `/engine/docs/<id>` |
| Render | Same engine from the terminal; the skills' `build.py` shims call it | `./forge.sh render …` |

**Backend switch.** `auto` uses the Anthropic API when a real key exists, else **headless Claude Code on Shad's own login**. Today it runs on the login: isolated (603 vs 17,706 context tokens) and read-only.

## Done

- [x] Registry refactor: types as folders, `DocumentType` derived from the registry
- [x] Families ported byte-faithfully: replyCast (email, paste), plexio note, warden email, athena (Gen 3), thread
- [x] **Cutover:** replyCast, thread and plexio-note builders are shims; originals frozen as `*_legacy.py`
- [x] Skill docs updated: replyCast, plexio, warden, athena
- [x] Agentic search on GNU grep, with a PDF text cache and path-escape guards
- [x] Uploads (PDF / DOCX / TXT / MD / HTML) and a library
- [x] Document store: versioned and append-only, plus the editor and revise
- [x] `/chat`: session catalog, live tool activity, verified source cards, Stop, Forge-this
- [x] No invented greetings or sign-offs in forged documents (enforced in the schema and the prompt)

## Benchmark

> [!success] Parity: TypeScript vs the original Python
> | Check | Result |
> |---|---|
> | Every real draft, drift sweep | **57 / 57 identical** |
> | Live cutover (old Python vs shim, on copies) | replyCast **36/36** · plexio **5/5** · thread **2/2** |
> | SVG visuals (30 real flows) | **128 / 128 identical** |
> | Goldens (email, paste, text, web) | 11 identical |
> | Generation round-trips · strict schemas | 9 / 9 · 4 / 4 |

| Metric | Value |
|---|---|
| TypeScript | 9,042 lines (families 2,780 · UI 1,376 · scripts 727) |
| Surface | 12 API routes · 4 pages · 4 families + thread |
| Golden fixtures | 178 files |
| Source footprint | 3.8 MB (+ `node_modules` 581 MB, `.next` 207 MB, both regenerable) |
| Headless context (isolated vs default) | **603** vs 17,706 tokens |
| Chat answer (Haiku test) | 4–11 s, 3–7 steps, every source verified |
| Forge on the login (Opus 5.5) | ~8 s, ≈ $0.03 plan-usage estimate |
| Regression suite | 12 / 12 green, `tsc` clean, build ok |

## Where things stand

> [!warning] Blocked on Shad
> - **API credits / key**: the `.env.local` key is an 11-char stub. Everything runs on the CLI login meanwhile.
> - **PDF printing**: the headless shell is blocked by AppArmor (`apparmor_restrict_unprivileged_userns=1`). Choose an AppArmor profile or `--no-sandbox`.
> - **athena chrome**: keep or strip the template's sidebar brand, topbar title and callout tone labels.

> [!todo] Still Python (not ported yet)
> - plexio **hard mode** (Synergy Universe skin, black-hole hero), `survey-report`, `thread-record`, hard flowmode web
> - warden **cosmic web + print** (`warden_world.py`, `warden_base.py`). Tokens live in both: run both checks after a change.

- [ ] Port plexio hard mode and warden cosmic, then retire the last Python renderers
- [ ] Live API receipts for Ask / Forge / Revise (needs credits)
- [ ] Commit `app/`: all of this session's work is uncommitted (root `forge.sh` sits outside git)

## Patterns to reuse in the next, bigger project

1. **Contract first, then a team.** The orchestrator writes the types and the receipt; Haiku agents port to them. No receipt, no merge.
2. **Golden parity before cutover.** Render every real input through the old and the new, diff the bytes, and only then flip the switch.
3. **Shim, don't delete.** The old entry points keep their interface and forward to the new engine; the originals freeze as evidence.
4. **Append-only state.** Versions and turns are never edited, so history is evidence for free.
5. **Isolate the agent.** Read-only tools, no hooks or settings, nothing written to session history, verified citations.

## Where to look

| Need | Open |
|---|---|
| Run it | `../forge.sh` → `/chat`, `/engine`, `/status` |
| Code map, receipts, rules | `app/CLAUDE.md` |
| Plan and history | `designRules/FORGE-SAAS-PLAN.md` (§9–11) |
| Design rules | `designRules/ui-ux-benchmark.md` (its bronze button spec fails contrast: use void-900 on bronze) |
| Rollback | `legacy/*-snapshot-2026-11-24.tar.gz` |
