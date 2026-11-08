import hashlib
import json

import pytest

from approve_rules import approve


def setup(tmp_path, ok=True):
    drafts = tmp_path / "drafts" / "offers"
    drafts.mkdir(parents=True)
    f = drafts / "x.json"
    f.write_text("[]")
    digest = hashlib.sha256(b"[]").hexdigest()
    (tmp_path / "drafts" / "CHECK.json").write_text(json.dumps({"ok": ok, "checkedOn": "2026-11-07", "files": [{"file": "offers/x.json", "sha256": digest}]}))
    (tmp_path / "drafts" / "DRAFT.json").write_text(json.dumps({"draftedBy": "model-draft"}))
    return f


def test_approve_moves_file_and_records_approval(tmp_path):
    setup(tmp_path)
    approve(tmp_path, ["offers/x.json"], "Qiao", "2026-11-07")
    assert (tmp_path / "offers" / "x.json").exists()
    ledger = json.loads((tmp_path / "approvals.json").read_text())
    assert ledger[0]["approvedBy"] == "Qiao" and ledger[0]["file"] == "offers/x.json"


def test_refuses_a_file_changed_after_the_check(tmp_path):
    f = setup(tmp_path)
    f.write_text("[1]")
    with pytest.raises(SystemExit, match="changed since"):
        approve(tmp_path, ["offers/x.json"], "Qiao", "2026-11-07")


def test_refuses_when_the_check_failed(tmp_path):
    setup(tmp_path, ok=False)
    with pytest.raises(SystemExit, match="did not pass"):
        approve(tmp_path, ["offers/x.json"], "Qiao", "2026-11-07")
