#!/usr/bin/env python3
"""Download Nancy OSM data via Overpass and cache a lean JSON in ./data."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

BBOX = (48.6865, 6.1680, 48.7015, 6.1975)  # S, W, N, E — centre historique + gare + canal
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

QUERY = f"""
[out:json][timeout:120];
(
  way["building"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  relation["building"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["highway"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["leisure"~"park|garden"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["landuse"~"grass|forest|recreation_ground|village_green"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["natural"="water"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["waterway"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["water"="canal"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["railway"~"rail|tram"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["place"="square"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["highway"="pedestrian"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["amenity"~"place_of_worship|marketplace|townhall|fountain"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["historic"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["shop"="marketplace"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["historic"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["tourism"="attraction"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["amenity"~"place_of_worship|marketplace|townhall|fountain"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["railway"="station"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out body;
>;
out skel qt;
"""

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RAW_PATH = os.path.join(DATA, "overpass-raw.json")
OUT_PATH = os.path.join(DATA, "nancy.json")


def fetch_overpass() -> dict:
    body = QUERY.encode("utf-8")
    last_err = None
    for url in ENDPOINTS:
        print(f"Overpass → {url}")
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Nancy3D/1.0 (local cache builder)",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                raw = resp.read()
            data = json.loads(raw.decode("utf-8"))
            if "elements" in data:
                print(f"  {len(data['elements'])} elements")
                return data
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            last_err = err
            print(f"  failed: {err}")
            time.sleep(2)
    raise RuntimeError(f"Overpass failed: {last_err}")


def way_coords(way: dict, nodes: dict) -> list:
    coords = []
    for nid in way.get("nodes", []):
        n = nodes.get(nid)
        if n:
            coords.append([n["lon"], n["lat"]])
    return coords


def polygon_centroid(coords: list) -> list:
    if not coords:
        return [0, 0]
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    return [sum(xs) / len(xs), sum(ys) / len(ys)]


def parse_height(tags: dict) -> float | None:
    h = tags.get("height") or tags.get("building:height")
    if h:
        try:
            return float(str(h).replace("m", "").replace(",", ".").split()[0])
        except ValueError:
            pass
    levels = tags.get("building:levels") or tags.get("levels")
    if levels:
        try:
            return float(str(levels).replace(",", ".")) * 3.2
        except ValueError:
            pass
    roof = tags.get("roof:levels")
    extra = 0.0
    if roof:
        try:
            extra = float(str(roof).replace(",", ".")) * 2.4
        except ValueError:
            extra = 0.0
    if extra:
        return 10.0 + extra
    return None


def process(raw: dict) -> dict:
    nodes = {}
    ways = []
    rels = []
    for el in raw.get("elements", []):
        t = el.get("type")
        if t == "node":
            nodes[el["id"]] = el
        elif t == "way":
            ways.append(el)
        elif t == "relation":
            rels.append(el)

    buildings = []
    roads = []
    parks = []
    water = []
    canals = []
    rails = []
    squares = []
    pois = []

    for n in nodes.values():
        tags = n.get("tags") or {}
        if not tags:
            continue
        if any(k in tags for k in ("historic", "tourism", "amenity", "railway", "name")):
            if tags.get("historic") or tags.get("tourism") == "attraction" or tags.get(
                "amenity"
            ) in ("place_of_worship", "marketplace", "townhall", "fountain") or tags.get(
                "railway"
            ) == "station":
                pois.append(
                    {
                        "id": n["id"],
                        "lon": n["lon"],
                        "lat": n["lat"],
                        "name": tags.get("name"),
                        "tags": {
                            k: tags[k]
                            for k in (
                                "historic",
                                "tourism",
                                "amenity",
                                "railway",
                                "name",
                                "religion",
                                "building",
                            )
                            if k in tags
                        },
                    }
                )

    for w in ways:
        tags = w.get("tags") or {}
        if not tags:
            continue
        coords = way_coords(w, nodes)
        if len(coords) < 2:
            continue
        name = tags.get("name")
        base = {"id": w["id"], "name": name, "coords": coords}

        if "building" in tags or tags.get("amenity") in (
            "place_of_worship",
            "townhall",
            "marketplace",
        ):
            height = parse_height(tags)
            buildings.append(
                {
                    **base,
                    "height": height,
                    "building": tags.get("building"),
                    "amenity": tags.get("amenity"),
                    "historic": tags.get("historic"),
                    "religion": tags.get("religion"),
                    "roof": tags.get("roof:shape"),
                    "levels": tags.get("building:levels"),
                    "centroid": polygon_centroid(coords),
                }
            )
            continue

        if tags.get("railway") in ("rail", "tram"):
            rails.append({**base, "kind": tags.get("railway")})
            continue

        if tags.get("waterway") or tags.get("natural") == "water" or tags.get("water") == "canal":
            rec = {
                **base,
                "waterway": tags.get("waterway"),
                "natural": tags.get("natural"),
                "water": tags.get("water"),
            }
            if tags.get("waterway") == "canal" or tags.get("water") == "canal" or (
                name and "canal" in name.lower()
            ):
                canals.append(rec)
            else:
                water.append(rec)
            continue

        if tags.get("leisure") in ("park", "garden") or tags.get("landuse") in (
            "grass",
            "forest",
            "recreation_ground",
            "village_green",
        ):
            parks.append({**base, "kind": tags.get("leisure") or tags.get("landuse")})
            continue

        if tags.get("place") == "square" or (
            tags.get("highway") == "pedestrian" and name and "place" in name.lower()
        ):
            squares.append({**base, "highway": tags.get("highway")})
            continue

        hw = tags.get("highway")
        if hw and hw not in ("footway", "steps", "corridor", "elevator"):
            roads.append({**base, "highway": hw})

        if tags.get("historic") or tags.get("amenity") == "fountain":
            c = polygon_centroid(coords)
            pois.append(
                {
                    "id": w["id"],
                    "lon": c[0],
                    "lat": c[1],
                    "name": name,
                    "tags": {
                        k: tags[k]
                        for k in ("historic", "amenity", "name", "tourism")
                        if k in tags
                    },
                }
            )

    return {
        "bbox": {"south": BBOX[0], "west": BBOX[1], "north": BBOX[2], "east": BBOX[3]},
        "origin": {"lat": 48.69361, "lon": 6.18306, "name": "Place Stanislas"},
        "counts": {
            "buildings": len(buildings),
            "roads": len(roads),
            "parks": len(parks),
            "water": len(water),
            "canals": len(canals),
            "rails": len(rails),
            "squares": len(squares),
            "pois": len(pois),
        },
        "buildings": buildings,
        "roads": roads,
        "parks": parks,
        "water": water,
        "canals": canals,
        "rails": rails,
        "squares": squares,
        "pois": pois,
    }


def main() -> int:
    os.makedirs(DATA, exist_ok=True)
    force = "--force" in sys.argv
    if os.path.isfile(OUT_PATH) and not force:
        print(f"Cache already present: {OUT_PATH}")
        with open(OUT_PATH, encoding="utf-8") as f:
            data = json.load(f)
        print("counts:", data.get("counts"))
        return 0

    raw = fetch_overpass()
    with open(RAW_PATH, "w", encoding="utf-8") as f:
        json.dump(raw, f)
    processed = process(raw)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(processed, f)
    print("Wrote", OUT_PATH)
    print("counts:", processed["counts"])
    size = os.path.getsize(OUT_PATH) / 1e6
    print(f"size: {size:.2f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
