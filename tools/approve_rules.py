"""Qiao's approval step (docs/product.md §6a, step 4). Run by Qiao only.

Usage: python3 tools/approve_rules.py --by Qiao FILE [FILE ...]
FILE is relative to rules/ma/drafts/, e.g. offers/heat-pumps.json.

Each file must match a passing `npm run rules:check-drafts` (drafts/CHECK.json, same sha256). The file moves from
drafts/ into the active rules and an entry is appended to rules/ma/approvals.json.
"""
import argparse
import datetime
import hashlib
import json
import shutil
from pathlib import Path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def approve(root: Path, files: list[str], by: str, today: str) -> None:
    drafts = root / "drafts"
    check = json.loads((drafts / "CHECK.json").read_text(encoding="utf-8"))
    if not check.get("ok"):
        raise SystemExit("The last draft check did not pass. Fix the drafts and run npm run rules:check-drafts.")
    checked = {f["file"]: f["sha256"] for f in check["files"]}
    meta = json.loads((drafts / "DRAFT.json").read_text(encoding="utf-8"))
    ledger_path = root / "approvals.json"
    ledger = json.loads(ledger_path.read_text(encoding="utf-8")) if ledger_path.exists() else []
    for rel in files:
        src = drafts / rel
        digest = sha256(src)
        if checked.get(rel) != digest:
            raise SystemExit(f"{rel} changed since the last passing check. Run npm run rules:check-drafts again.")
        dest = root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))
        ledger.append({"file": rel, "sha256": digest, "draftedBy": meta["draftedBy"], "checkedOn": check["checkedOn"],
                       "approvedBy": by, "approvedOn": today})
        print(f"approved {rel}")
    ledger_path.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--by", required=True)
    ap.add_argument("files", nargs="+")
    args = ap.parse_args()
    approve(Path(__file__).resolve().parent.parent / "rules" / "ma", args.files, args.by, datetime.date.today().isoformat())
