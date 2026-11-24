#!/usr/bin/env python3
"""Regenerate Python expected outputs for every candidate draft, in SCR only.

Runs COPIES of the FROZEN originals (replyCast/build_legacy.py, artifactHtml/src/build_note_legacy.py) in a temp dir.
Never point this at build.py / build_note.py: since the 2026-11-24 cutover those are shims that call Forge,
so the comparison would be TS against TS. Output: app/golden/drift/expected (used by scripts/drift.ts).
Drafts are copied into per-draft folders in SCR/py, never run in place.
Outputs: SCR/expected/<name>.<family>.<kind>   (kind: email | text | web)
         SCR/expected/<name>.<family>.FAILED   (Python raised; text is the error)
"""
import sys, os, shutil, importlib.util, io, traceback, types, urllib.request
from pathlib import Path

sys.dont_write_bytecode = True
import tempfile
APP = Path(os.path.dirname(os.path.abspath(__file__))).parent
SCR = Path(tempfile.mkdtemp(prefix="forge-drift-"))
DRAFTS = Path("/home/shad/Documents/0_CurrentSessionDocuments/artifactHtml/drafts")
SRC_REPLY = Path("/home/shad/.claude/skills/replyCast/build_legacy.py")
SRC_NOTE = Path("/home/shad/Documents/0_CurrentSessionDocuments/artifactHtml/src/build_note_legacy.py")
EXP = APP / "golden" / "drift" / "expected"
PY = SCR / "py"

# Network stub: every urlopen returns the same bytes the TS side gets from its fetch stub.
class _Resp:
    def read(self): return b"IMG"
    def __enter__(self): return self
    def __exit__(self, *a): return False
def _fake_urlopen(url, *a, **k):
    return _Resp()
urllib.request.urlopen = _fake_urlopen

def load(name, src):
    dst = PY / name / (name + ".py")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, dst)
    spec = importlib.util.spec_from_file_location(f"scr_{name}", dst)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

reply_mod = load("replycast", SRC_REPLY)
# build_note.py must live under .../artifactHtml/src so its OUTDIR (../drafts) lands in SCR.
note_mod = load_note = None
note_dir = PY / "artifactHtml" / "src"
note_dir.mkdir(parents=True, exist_ok=True)
shutil.copy(SRC_NOTE, note_dir / "build_note.py")
spec = importlib.util.spec_from_file_location("scr_build_note", note_dir / "build_note.py")
note_mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(note_mod)
assert str(note_mod.OUTDIR).startswith(str(PY)), note_mod.OUTDIR

EXP.mkdir(parents=True, exist_ok=True)
count = {"ok": 0, "fail": 0}
for js in sorted(DRAFTS.glob("*.json")):
    if js.name.endswith(".meta.json"):
        continue
    name = js.stem
    # replycast
    d1 = PY / "replycast" / "drafts" / name
    d1.mkdir(parents=True, exist_ok=True)
    local = d1 / js.name
    shutil.copy(js, local)
    try:
        out = reply_mod.build(local)
        shutil.copy(out, EXP / f"{name}.replycast.email")
        count["ok"] += 1
    except Exception as e:
        (EXP / f"{name}.replycast.FAILED").write_text(f"{type(e).__name__}: {e}\n")
        count["fail"] += 1
    # plexio (build_note)
    local2 = note_dir.parent / "drafts" / js.name
    local2.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(js, local2)
    try:
        note_mod.build(str(local2))
        od = note_dir.parent / "drafts"
        shutil.copy(od / f"{name}.email.html", EXP / f"{name}.plexio.email")
        shutil.copy(od / f"{name}.txt", EXP / f"{name}.plexio.text")
        shutil.copy(od / f"{name}.html", EXP / f"{name}.plexio.web")
        count["ok"] += 1
    except Exception as e:
        (EXP / f"{name}.plexio.FAILED").write_text(f"{type(e).__name__}: {e}\n")
        count["fail"] += 1
print(f"regen: python runs ok={count['ok']} failed={count['fail']} -> {EXP}")
