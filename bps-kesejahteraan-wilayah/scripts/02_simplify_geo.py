"""02_simplify_geo.py - Menyederhanakan batas wilayah agar ringan di web (toleransi ~500 m)."""
import json
from shapely.geometry import shape, mapping
TOL = 0.005                                    # derajat (~550 m)
g = json.load(open("data/processed/kabkota_clean.geojson"))
bad = 0
for f in g["features"]:
    geom = shape(f["geometry"])
    if not geom.is_valid: geom = geom.buffer(0); bad += 1
    s = geom.simplify(TOL, preserve_topology=True)
    assert not s.is_empty
    f["geometry"] = json.loads(json.dumps(mapping(s)))
def rnd(c): return [round(c[0], 3), round(c[1], 3)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]
for f in g["features"]: f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
json.dump(g, open("data/processed/kabkota.geojson", "w"), separators=(",", ":"))
print("fitur:", len(g["features"]), "| geometri tidak valid diperbaiki:", bad)
