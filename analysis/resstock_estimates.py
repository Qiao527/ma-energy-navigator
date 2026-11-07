"""ResStock stock estimates for Massachusetts 2–4 unit homes (Task 16b, docs/phase-1-plan.md).

Usage: python3 -I analysis/resstock_estimates.py PATH_TO_MA_upgrade0.csv.gz
  Download the file into an empty folder outside the repo first (17.5 MB):
  https://oedi-data-lake.s3.amazonaws.com/nrel-pds-building-stock/end-use-load-profiles-for-us-building-stock/2025/resstock_amy2018_release_1/metadata_and_annual_results/by_state/full/csv/state%3DMA/MA_upgrade0.csv.gz

Writes rules/ma/drafts/assumptions-resstock.json. It is a draft: it goes through npm run rules:check-drafts and Qiao's
approval like every rule file (docs/product.md §6a). Each ResStock model is one dwelling unit, so values are per unit.
"""
import csv
import gzip
import io
import json
import sys
import tarfile
from pathlib import Path

DATASET = ("https://oedi-data-lake.s3.amazonaws.com/nrel-pds-building-stock/end-use-load-profiles-for-us-building-stock/"
           "2025/resstock_amy2018_release_1/metadata_and_annual_results/by_state/full/csv/state%3DMA/MA_upgrade0.csv.gz")
DICTIONARY = ("https://oedi-data-lake.s3.amazonaws.com/nrel-pds-building-stock/end-use-load-profiles-for-us-building-stock/"
              "2025/resstock_amy2018_release_1/data_dictionary.tsv")
CITATION = ("https://oedi-data-lake.s3.amazonaws.com/nrel-pds-building-stock/end-use-load-profiles-for-us-building-stock/"
            "2025/resstock_amy2018_release_1/citation.txt")
VERIFIED = "2026-11-07"

COLUMNS = {
    "type": "in.geometry_building_type_recs",
    "fuel": "in.heating_fuel",
    "vintage": "in.vintage",
    "load": "out.load.heating.energy_delivered..kbtu",
    "size": "out.params.size_heating_system_primary..kbtu_per_hr",
    "weight": "weight",
}
TYPE = "Multi-Family with 2 - 4 Units"
FUELS = {"Fuel Oil": "oil", "Natural Gas": "natural_gas", "Propane": "propane"}
FUEL_WORDS = {"oil": "oil heat", "natural_gas": "gas heat", "propane": "propane heat"}
BANDS = {"<1940": "pre1950", "1940s": "pre1950", "1950s": "1950_1999", "1960s": "1950_1999", "1970s": "1950_1999",
         "1980s": "1950_1999", "1990s": "1950_1999", "2000s": "2000_plus", "2010s": "2000_plus"}
BAND_WORDS = {"pre1950": "built before 1950", "1950_1999": "built 1950–1999", "2000_plus": "built 2000 or later"}
QUANTITIES = {
    "annual_heat_load_mmbtu": ("load", 1 / 1000, 1, "MMBtu per year",
                               "Heat delivered per year",
                               ("out.load.heating.energy_delivered..kbtu", "Total energy delivered by heating system includes HVAC distribution losses.")),
    "heat_pump_tons": ("size", 1 / 12, 2, "tons",
                       "Size of the main heating system",
                       ("out.params.size_heating_system_primary..kbtu_per_hr", "Size, Heating System Primary")),
}


def read_rows(path: Path):
    """Rows of the ResStock CSV; the state file is a gzip that may wrap a tar archive."""
    if tarfile.is_tarfile(path):
        with tarfile.open(path, "r:gz") as t:
            member = next(m for m in t.getmembers() if m.name.endswith(".csv"))
            f = t.extractfile(member)
            yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
        return
    with gzip.open(path, "rt", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def weighted_quantile(pairs, q: float) -> float:
    """The first value (in sorted order) at which the cumulative weight reaches q of the total."""
    pairs = sorted(pairs)
    total = sum(w for _, w in pairs)
    cum = 0.0
    for value, w in pairs:
        cum += w
        if cum >= q * total - 1e-9:
            return value
    return pairs[-1][0]


def _source(section: str, quote: str) -> dict:
    return {"url": DICTIONARY, "section": section, "quote": quote, "lastVerified": VERIFIED}


def estimates(rows, min_samples: int = 30) -> list[dict]:
    groups: dict[tuple, list] = {}
    for r in rows:
        if r[COLUMNS["type"]] != TYPE or r[COLUMNS["fuel"]] not in FUELS:
            continue
        band = BANDS.get(r[COLUMNS["vintage"]])
        if band is None:
            raise ValueError(f"unknown vintage label: {r[COLUMNS['vintage']]!r}")
        fuel = FUELS[r[COLUMNS["fuel"]]]
        for key in ((fuel, band), (fuel, None)):
            groups.setdefault(key, []).append(r)
    out = []
    for (fuel, band), members in sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][1] or "")):
        if len(members) < min_samples:
            continue
        for qid, (col, factor, digits, unit, label, (section, quote)) in QUANTITIES.items():
            pairs = [(float(m[COLUMNS[col]]) * factor, float(m[COLUMNS["weight"]])) for m in members]
            low, mid, high = (round(weighted_quantile(pairs, q), digits) for q in (0.25, 0.5, 0.75))
            group = FUEL_WORDS[fuel] + (f", {BAND_WORDS[band]}" if band else "")
            out.append({
                "id": f"{qid}.{fuel}" + (f".{band}" if band else ""),
                "description": f"{label}: typical for similar Massachusetts 2–4 unit homes ({group}; ResStock, simulated), "
                               "not measured for yours. Range = 25th / 50th / 75th percentile",
                "unit": unit,
                "value": {"low": low, "mid": mid, "high": high},
                "confidence": "low",
                "dataset": DATASET,
                "sampleSize": len(members),
                "sources": [
                    _source(section, quote),
                    _source("weight", "Number of dwelling units this model represents in real life."),
                    {"url": CITATION, "section": "DATASET", "quote": "License CC-BY-4.0", "lastVerified": VERIFIED},
                ],
            })
    return out


def main(path: str) -> None:
    result = estimates(read_rows(Path(path)))
    target = Path(__file__).resolve().parent.parent / "rules" / "ma" / "drafts" / "assumptions-resstock.json"
    target.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {target}: {len(result)} estimates")
    for e in result:
        v = e["value"]
        print(f"  {e['id']:44} {v['low']:>7} {v['mid']:>7} {v['high']:>7}  n={e['sampleSize']}")


if __name__ == "__main__":
    main(sys.argv[1])
