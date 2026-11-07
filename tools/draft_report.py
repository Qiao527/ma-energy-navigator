"""Write rules/ma/drafts/REVIEW.md: a human-readable view of every draft rule for Qiao's review (product.md §6a, step 4).

Usage: python3 tools/draft_report.py   (run after npm run rules:check-drafts)
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "rules" / "ma"
D = ROOT / "drafts"


def cond(c) -> str:
    if c is None:
        return "—"
    if "all" in c:
        return "(" + " AND ".join(cond(x) for x in c["all"]) + ")"
    if "any" in c:
        return "(" + " OR ".join(cond(x) for x in c["any"]) + ")"
    if "not" in c:
        return "NOT " + cond(c["not"])
    if "fact" in c:
        return f"{c['fact']} {c['op']} {json.dumps(c['value'])}"
    if "ref" in c:
        return f"[{c['ref']}]"
    if "allUnits" in c:
        return f"every unit where {cond(c['allUnits']['eligible'])} has {cond(c['allUnits']['require'])}"
    k = next(iter(c))
    return f"{k} {c[k]}"


def quotes(sources) -> list[str]:
    return [f"  - > {s['quote']}\n    — {s['url']} ({s['section']}, verified {s['lastVerified']})" for s in sources]


def main() -> None:
    check = json.loads((D / "CHECK.json").read_text())
    out = ["# Draft rules for review", "",
           f"Automatic check: **{'passed' if check['ok'] else 'FAILED'}** on {check['checkedOn']} "
           f"({len(check['files'])} files). Every quote below was found verbatim in the saved snapshot in `rules/ma/sources/`.", "",
           "Approve with `python3 tools/approve_rules.py --by Qiao FILE ...` (files relative to `rules/ma/drafts/`).", ""]
    for f in check["files"]:
        doc = json.loads((D / f["file"]).read_text())
        out += [f"## `{f['file']}`", "", f"sha256 `{f['sha256'][:12]}…`", ""]
        items = doc if isinstance(doc, list) else [doc]
        for x in items:
            if "eligibility" in x:
                eff = x["effective"]
                out += [f"### {x['title']} (`{x['id']}@{x['version']}`)", "",
                        f"- Measure: {x['measure']}; applies to: {x['appliesTo']}; recipient: {x['recipient']}; enrollment: {x['enrollment']}",
                        f"- Dates ({x['dateBasis']}): {eff['from']} → {eff['until'] or 'open'}; application deadline: {x['applicationDeadline'] or '—'}",
                        f"- Eligibility: {cond(x['eligibility'])}",
                        f"- Benefit: `{json.dumps(x['benefit'])}` ({x['qualification']})"]
                for p in x["prerequisites"]:
                    out.append(f"- Prerequisite ({p['kind']}): {p['description']} — done when {cond(p['satisfiedWhen'])}")
                for c in x["confirmations"]:
                    out.append(f"- Confirmation by {c['decidedBy']}: {c['question']} (asked when {cond(c['when'])})")
                out += ["- Sources:"] + quotes(x["sources"]) + [""]
            else:
                label = x.get("id") or x.get("name") or (f"{x['before']} → {x['after']}" if "before" in x else "DEC municipalities")
                out.append(f"### {label}")
                out.append("")
                for k in ("summary", "leaseCheck", "disclaimer", "note", "reason", "label", "window", "bySize", "limit", "condition"):
                    if isinstance(x, dict) and k in x:
                        v = cond(x[k]) if k == "condition" else json.dumps(x[k]) if not isinstance(x[k], str) else x[k]
                        out.append(f"- {k}: {v}")
                if isinstance(x, dict) and "municipalities" in x:
                    out.append(f"- municipalities ({len(x['municipalities'])}): " + ", ".join(m["name"] for m in x["municipalities"]))
                for k in ("resources", "sources"):
                    if isinstance(x, dict) and x.get(k):
                        out += [f"- {k}:"] + quotes(x[k])
                out.append("")
    (D / "REVIEW.md").write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {D / 'REVIEW.md'}: {len(out)} lines")


if __name__ == "__main__":
    main()
