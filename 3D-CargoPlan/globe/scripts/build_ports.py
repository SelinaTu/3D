#!/usr/bin/env python3
#created 11/08/2026
"""Build ports.json from UN/LOCODE seaports + merge deep flags from ports_index.yaml."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp" / "unlocode.csv"
OUT = ROOT / "data" / "ports.json"
INDEX = ROOT.parent / "docs" / "port-knowledge" / "data" / "ports_index.yaml"

# Ports with existing md dossiers → depth=deep
DEEP_LOCODES = {
    "CNSHA", "CNNGB", "CNSZX", "CNTAO", "CNCAN", "CNTXG", "CNXMN", "CNDLC",
    "SGSIN", "KRPUS", "AEJEA", "MYPKG", "NLRTM", "USLAX", "USLGB", "USNYC", "DEHAM",
    "IDTPP", "IDSUB", "IDBLW", "IDMAK", "IDSRG",
}

# Prefer names / zh from our index when present
NAME_OVERRIDES: dict[str, dict] = {}

COORD_RE = re.compile(
    r"^\s*(\d{2})(\d{2})([NS])\s+(\d{3})(\d{2})([EW])\s*$"
)


def parse_coord(s: str) -> tuple[float, float] | None:
    s = (s or "").strip()
    m = COORD_RE.match(s)
    if not m:
        return None
    lat_d, lat_m, ns, lon_d, lon_m, ew = m.groups()
    lat = int(lat_d) + int(lat_m) / 60.0
    lon = int(lon_d) + int(lon_m) / 60.0
    if ns == "S":
        lat = -lat
    if ew == "W":
        lon = -lon
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return lat, lon


def load_index_overrides() -> None:
    """Minimal YAML pull for name_zh / preferred English names — no PyYAML required for full parse."""
    if not INDEX.exists():
        return
    text = INDEX.read_text(encoding="utf-8")
    # Very small state machine for our ports_index shape
    cur: dict | None = None
    for line in text.splitlines():
        if line.strip().startswith("- port_id:"):
            if cur and cur.get("port_id"):
                NAME_OVERRIDES[cur["port_id"]] = cur
            cur = {"port_id": line.split(":", 1)[1].strip().strip('"')}
        elif cur is None:
            continue
        elif m := re.match(r"\s+name:\s*(.+)$", line):
            cur["name"] = m.group(1).strip().strip('"')
        elif m := re.match(r"\s+name_zh:\s*(.+)$", line):
            cur["name_zh"] = m.group(1).strip().strip('"')
        elif m := re.match(r"\s+country:\s*(.+)$", line):
            cur["country"] = m.group(1).strip().strip('"')
    if cur and cur.get("port_id"):
        NAME_OVERRIDES[cur["port_id"]] = cur


def is_seaport(function: str) -> bool:
    # UNECE function: position 0 = '1' means port (maritime transport terminal)
    f = (function or "").strip()
    if not f:
        return False
    return "1" in f  # any seaport function bit


def main() -> None:
    load_index_overrides()
    if not TMP.exists():
        raise SystemExit(f"Missing UN/LOCODE CSV at {TMP}")

    by_locode: dict[str, dict] = {}
    skipped_no_coord = 0
    skipped_not_sea = 0

    with TMP.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            country = (row.get("Country") or "").strip().upper()
            loc = (row.get("Location") or "").strip().upper()
            if not country or not loc or len(loc) != 3:
                continue
            # Skip country subdivision header rows sometimes empty Location
            fn = row.get("Function") or ""
            if not is_seaport(fn):
                skipped_not_sea += 1
                continue
            coords = parse_coord(row.get("Coordinates") or "")
            if not coords:
                skipped_no_coord += 1
                continue
            locode = country + loc
            name = (row.get("NameWoDiacritics") or row.get("Name") or locode).strip()
            entry = {
                "locode": locode,
                "name": name,
                "lat": round(coords[0], 5),
                "lon": round(coords[1], 5),
                "country": country,
                "depth": "deep" if locode in DEEP_LOCODES else "thin",
                "functions": fn.strip(),
            }
            # Prefer first with coordinates; if duplicate keep existing unless new is deep
            if locode in by_locode:
                if entry["depth"] == "deep":
                    by_locode[locode]["depth"] = "deep"
                continue
            by_locode[locode] = entry

    # Ensure deep ports from our index exist even if LOCODE miss
    FALLBACK_COORDS = {
        "CNSHA": (31.2304, 121.4737, "Shanghai", "上海"),
        "CNNGB": (29.8683, 121.5440, "Ningbo-Zhoushan", "宁波舟山"),
        "CNSZX": (22.5431, 114.0579, "Shenzhen", "深圳"),
        "CNTAO": (36.0671, 120.3826, "Qingdao", "青岛"),
        "CNCAN": (23.1291, 113.2644, "Guangzhou", "广州"),
        "CNTXG": (39.0842, 117.2010, "Tianjin", "天津"),
        "CNXMN": (24.4798, 118.0894, "Xiamen", "厦门"),
        "CNDLC": (38.9140, 121.6147, "Dalian", "大连"),
        "SGSIN": (1.2644, 103.8220, "Singapore", None),
        "KRPUS": (35.1028, 129.0403, "Busan", "釜山"),
        "AEJEA": (25.0118, 55.0619, "Jebel Ali", None),
        "MYPKG": (2.9990, 101.3928, "Port Klang", None),
        "NLRTM": (51.9480, 4.1420, "Rotterdam", None),
        "USLAX": (33.7292, -118.2620, "Los Angeles", None),
        "USLGB": (33.7542, -118.2165, "Long Beach", None),
        "USNYC": (40.6681, -74.0450, "New York / New Jersey", None),
        "DEHAM": (53.5461, 9.9663, "Hamburg", None),
        "IDTPP": (-6.1045, 106.8800, "Tanjung Priok", "丹戎不碌"),
        "IDSUB": (-7.2080, 112.7330, "Tanjung Perak", "丹戎佩拉克"),
        "IDBLW": (3.7840, 98.6940, "Belawan", "勿拉湾"),
        "IDMAK": (-5.1330, 119.4080, "Makassar", "望加锡"),
        "IDSRG": (-6.9480, 110.4240, "Tanjung Emas", "丹戎埃马斯"),
    }
    for locode, (lat, lon, name, name_zh) in FALLBACK_COORDS.items():
        if locode not in by_locode:
            by_locode[locode] = {
                "locode": locode,
                "name": name,
                "lat": lat,
                "lon": lon,
                "country": locode[:2],
                "depth": "deep",
                "functions": "1-------",
            }
            if name_zh:
                by_locode[locode]["name_zh"] = name_zh
        else:
            by_locode[locode]["depth"] = "deep"
            # Prefer our curated English name for deep ports
            by_locode[locode]["name"] = name
            if name_zh:
                by_locode[locode]["name_zh"] = name_zh

    for locode, ov in NAME_OVERRIDES.items():
        if locode in by_locode:
            if ov.get("name"):
                by_locode[locode]["name"] = ov["name"]
            if ov.get("name_zh"):
                by_locode[locode]["name_zh"] = ov["name_zh"]

    ports = sorted(by_locode.values(), key=lambda p: p["locode"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(ports, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    deep_n = sum(1 for p in ports if p["depth"] == "deep")
    print(f"Wrote {OUT} · ports={len(ports)} deep={deep_n} skipped_no_coord={skipped_no_coord}")


if __name__ == "__main__":
    main()
