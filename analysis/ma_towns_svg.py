"""Massachusetts municipalities as simplified SVG paths for the web map (M4b).

Usage: python3 -I analysis/ma_towns_svg.py PATH_TO/cb_2023_25_cousub_500k.shp
  Source: U.S. Census Bureau cartographic boundary file, county subdivisions, Massachusetts, 2023 (1:500k):
  https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_25_cousub_500k.zip
  County subdivisions are Massachusetts' 351 cities and towns, the same basis the engine uses for municipality
  (docs/data-sources.md §1). Download into an empty folder outside the repo first.

Writes web/src/ma-towns.json: {viewBox, source, towns: [{name, d, x, y}]} where (x, y) is a label point.
Standard library only.
"""
import json
import math
import struct
import sys
from pathlib import Path

SOURCE = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_25_cousub_500k.zip"
WIDTH = 1000.0
TOLERANCE = 0.9  # SVG units (the map is 1000 wide): about 0.3 km on the ground


def read_dbf(path: Path) -> list[dict]:
    data = path.read_bytes()
    n, header_len, rec_len = struct.unpack("<IHH", data[4:12])
    fields, pos = [], 32
    while data[pos] != 0x0D:
        name = data[pos:pos + 11].split(b"\0")[0].decode()
        fields.append((name, data[pos + 16]))
        pos += 32
    rows = []
    for i in range(n):
        rec = data[header_len + i * rec_len: header_len + (i + 1) * rec_len]
        off, row = 1, {}
        for name, length in fields:
            row[name] = rec[off:off + length].decode("utf-8", "replace").strip()
            off += length
        rows.append(row)
    return rows


def read_shp(path: Path) -> list[list[list[tuple[float, float]]]]:
    """Polygon records (shape type 5) as lists of rings of (lon, lat)."""
    data = path.read_bytes()
    pos, shapes = 100, []
    while pos < len(data):
        _, length = struct.unpack(">II", data[pos:pos + 8])
        body = data[pos + 8: pos + 8 + length * 2]
        pos += 8 + length * 2
        if struct.unpack("<i", body[:4])[0] != 5:
            shapes.append([])
            continue
        nparts, npoints = struct.unpack("<ii", body[36:44])
        parts = list(struct.unpack(f"<{nparts}i", body[44:44 + 4 * nparts]))
        pts_off = 44 + 4 * nparts
        pts = [struct.unpack("<dd", body[pts_off + 16 * k: pts_off + 16 * k + 16]) for k in range(npoints)]
        bounds = parts + [npoints]
        shapes.append([pts[bounds[j]:bounds[j + 1]] for j in range(nparts)])
    return shapes


def simplify(points: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Douglas–Peucker, iterative."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = points[a], points[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-12
        best, idx = -1.0, -1
        for k in range(a + 1, b):
            px, py = points[k]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm if (dx or dy) else math.hypot(px - ax, py - ay)
            if d > best:
                best, idx = d, k
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(points, keep) if k]


def build(shp: Path) -> dict:
    rows = read_dbf(shp.with_suffix(".dbf"))
    shapes = read_shp(shp)
    allpts = [p for s in shapes for ring in s for p in ring]
    lon0, lon1 = min(p[0] for p in allpts), max(p[0] for p in allpts)
    lat0, lat1 = min(p[1] for p in allpts), max(p[1] for p in allpts)
    k = math.cos(math.radians((lat0 + lat1) / 2))  # equirectangular, true at mid-latitude
    scale = WIDTH / ((lon1 - lon0) * k)
    height = (lat1 - lat0) * scale
    proj = lambda p: ((p[0] - lon0) * k * scale, (lat1 - p[1]) * scale)  # noqa: E731
    towns = []
    for row, shape in zip(rows, shapes):
        if row.get("NAME", "") in ("", "County subdivisions not defined") or not shape:
            continue
        rings, area_best, label = [], -1.0, (0.0, 0.0)
        for ring in shape:
            pts = simplify([proj(p) for p in ring], TOLERANCE)
            if len(pts) < 4:
                continue
            area = abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))) / 2
            if area > area_best:
                area_best, label = area, (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
            rings.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
        if rings:
            towns.append({"name": row["NAME"], "d": "".join(rings), "x": round(label[0], 1), "y": round(label[1], 1)})
    towns.sort(key=lambda t: t["name"])
    return {"viewBox": f"0 0 {WIDTH:.0f} {height:.0f}", "source": SOURCE, "towns": towns}


def main(path: str) -> None:
    out = build(Path(path))
    target = Path(__file__).resolve().parent.parent / "web" / "src" / "ma-towns.json"
    target.write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {target}: {len(out['towns'])} municipalities, {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1])
