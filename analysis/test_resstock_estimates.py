import csv
import gzip
import io
import tarfile

import pytest

from resstock_estimates import COLUMNS, estimates, read_rows, weighted_quantile

TYPE = "Multi-Family with 2 - 4 Units"


def row(fuel="Fuel Oil", vintage="<1940", load_kbtu=36000.0, size_kbtuh=30.0, weight=250.0, btype=TYPE):
    return {COLUMNS["type"]: btype, COLUMNS["fuel"]: fuel, COLUMNS["vintage"]: vintage,
            COLUMNS["load"]: str(load_kbtu), COLUMNS["size"]: str(size_kbtuh), COLUMNS["weight"]: str(weight)}


def test_weighted_quantile_is_the_first_value_reaching_the_cumulative_weight():
    assert weighted_quantile([(1, 1), (2, 1), (3, 1), (4, 1)], 0.5) == 2
    assert weighted_quantile([(1, 1), (2, 1), (3, 1), (4, 1)], 0.75) == 3
    assert weighted_quantile([(10, 3), (20, 1)], 0.5) == 10


def test_groups_by_fuel_and_vintage_converts_units_and_keeps_only_2_to_4_unit_buildings():
    rows = [row(load_kbtu=1000 * (i + 1), size_kbtuh=12 * (1 + i % 3)) for i in range(40)]
    rows += [row(btype="Single-Family Detached") for _ in range(50)]
    out = {e["id"]: e for e in estimates(rows, min_samples=30)}
    pre = out["annual_heat_load_mmbtu.oil.pre1950"]
    assert pre["sampleSize"] == 40 and pre["confidence"] == "low"
    assert (pre["value"]["low"], pre["value"]["mid"], pre["value"]["high"]) == (10.0, 20.0, 30.0)
    assert out["heat_pump_tons.oil.pre1950"]["value"]["mid"] == 2.0
    assert out["annual_heat_load_mmbtu.oil"]["sampleSize"] == 40
    assert "not measured for yours" in pre["description"]


def test_small_groups_are_left_out():
    rows = [row() for _ in range(40)] + [row(vintage="2010s") for _ in range(5)]
    ids = {e["id"] for e in estimates(rows, min_samples=30)}
    assert "annual_heat_load_mmbtu.oil.2000_plus" not in ids
    assert "annual_heat_load_mmbtu.oil" in ids
    assert not any(".propane" in i for i in ids)


def test_reads_plain_gzip_and_tar_gzip_csv(tmp_path):
    rows = [row() for _ in range(3)]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
    data = buf.getvalue().encode()
    plain = tmp_path / "a.csv.gz"
    plain.write_bytes(gzip.compress(data))
    tarred = tmp_path / "b.csv.gz"
    with tarfile.open(tarred, "w:gz") as t:
        info = tarfile.TarInfo("MA_upgrade0.csv")
        info.size = len(data)
        t.addfile(info, io.BytesIO(data))
    assert len(list(read_rows(plain))) == 3
    assert len(list(read_rows(tarred))) == 3


def test_unknown_vintage_label_fails_loudly():
    with pytest.raises(ValueError, match="vintage"):
        estimates([row(vintage="1800s") for _ in range(40)], min_samples=30)
