"""01_clean.py - Membersihkan data BPS 2023 + batas wilayah kab/kota.
Jalankan dari root repo:  python scripts/01_clean.py
Keluaran: data/processed/provinsi_2023.csv, kabkota_2023.csv, kabkota.geojson, data_issues.md
"""
import json, re, collections
import numpy as np, pandas as pd

RAW = "data/raw/"; OUT = "data/processed/"
issues = []                      # catatan masalah data -> data_issues.md
def log(msg): issues.append(msg); print(msg)

# ---------- util ----------
def num(v):
    """Angka format Indonesia: titik=ribuan, koma=desimal. '-' = tidak ada data."""
    if v is None or (isinstance(v, float) and np.isnan(v)): return np.nan
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip()
    if s in ("-", "–", ""): return np.nan
    return float(s.replace(".", "").replace(",", "."))

def squash(s):                   # kunci pencocokan nama: huruf kecil tanpa spasi/tanda baca
    return re.sub(r"[^a-z0-9]", "", str(s).lower())

PROV_ALIAS = {                   # variasi penulisan provinsi -> kunci kanonik
    "kepbangkabelitung": "kepulauanbangkabelitung", "bangkabelitung": "kepulauanbangkabelitung",
    "kepriau": "kepulauanriau",
    "diyogyakarta": "diyogyakarta", "daerahistimewayogyakarta": "diyogyakarta",
}
def pkey(s):
    k = squash(s); return PROV_ALIAS.get(k, k)

KAB_ALIAS = {                    # nama Excel -> nama GeoJSON (hanya yang ejaannya berbeda jauh)
    "malukutenggarabarat": "kepulauantanimbar", "mamujuutara": "pasangkayu",
    "tobasamosir": "toba", "tobasamosirtoba": "toba", "kepulauanseribu": "admkepseribu", "kepseribu": "admkepseribu",
    "malukutenggarabaratkepulauantanimbar": "kepulauantanimbar", "mamujuutarapasangkayu": "pasangkayu",
    "kotamakasar": "kotamakassar",
    "siautagulandangbiaro": "kepsiautagulandangbiaro",
    "kotapadangsidimpuan": "kotapadangsidempuan",
    **{f"kotajakarta{a}": f"kotaadmjakarta{a}" for a in ["barat","pusat","selatan","timur","utara"]},
}
NEW2OLD = {"Papua Selatan": "Papua", "Papua Tengah": "Papua", "Papua Pegunungan": "Papua",
           "Papua Barat Daya": "Papua Barat"}   # batas lama (sebelum pemekaran 2022) untuk analisis provinsi

# ---------- 1. GeoJSON ----------
g = json.load(open(RAW + "kabkota.geojson"))
feats = g["features"]
log(f"[GeoJSON] fitur awal: {len(feats)}")
for f in feats:
    p = f["properties"]
    if len(p["kode"]) == 4:                       # '91.2' -> '91.20' (nol di belakang hilang)
        log(f"[GeoJSON] kode {p['kode']} ({p['nama']}) diperbaiki menjadi {p['kode']}0"); p["kode"] += "0"
    p["kota"] = p["nama"].startswith("Kota ")      # flag lama salah untuk Kotawaringin/Kotabaru
seen = collections.defaultdict(list)
for i, f in enumerate(feats): seen[f["properties"]["kode"]].append(i)
drop = set()
for k, idx in seen.items():
    if len(idx) > 1:
        names = [(feats[i]["properties"]["nama"], feats[i]["properties"]["prov"]) for i in idx]
        keep = [i for i in idx if feats[i]["properties"]["prov"] == "Papua Barat Daya"] or idx[:1]
        for i in idx:
            if i not in keep: drop.add(i)
        log(f"[GeoJSON] kode ganda {k}: {names} -> fitur duplikat dibuang (indeks {sorted(set(idx)-set(keep))})")
feats = [f for i, f in enumerate(feats) if i not in drop]
geo = pd.DataFrame([f["properties"] for f in feats])
geo["gkey"] = geo.nama.map(squash)
geo["kode_prov"] = geo.kode.str[:2]
geo["prov_analisis"] = geo.prov.map(lambda p: NEW2OLD.get(p, p))
assert geo.kode.is_unique and len(geo) == 514, len(geo)
log(f"[GeoJSON] setelah perbaikan: {len(geo)} fitur, kode unik")

# ---------- 2. Tabel kab/kota (IPM, penduduk miskin) ----------
raw = pd.read_excel(RAW + "visualisasi_bps.xlsx", sheet_name=None, dtype=object)
def parse_kab(df, valname):
    df = df.dropna(how="all").dropna(axis=1, how="all").copy(); df.columns = ["nama", "val"]
    rows, prov_rows, cur = [], {}, None
    for n, v in zip(df.nama, df.val):
        n = str(n).strip()
        if n == n.upper():  cur = n; prov_rows[n] = num(v)          # baris provinsi (huruf kapital)
        else:               rows.append((cur, n, num(v)))
    return pd.DataFrame(rows, columns=["prov_excel", "nama_excel", valname]), prov_rows
ipm, ipm_prov = parse_kab(raw["IPM"], "ipm")
pm,  pm_prov  = parse_kab(raw["Jumlah Penduduk"], "jml_miskin")

# IPM: kab/kota Papua muncul dua kali (provinsi lama & baru) -> pertahankan blok provinsi baru
ipm["xkey"] = ipm.nama_excel.map(squash)
dup = ipm[ipm.xkey.duplicated(keep=False)]
chk = dup.groupby("xkey").ipm.nunique().max() if len(dup) else 1
log(f"[IPM] baris kab/kota di Excel: {len(ipm)}; baris ganda (blok provinsi lama & baru): {len(dup)}; nilai ganda identik: {chk == 1}")
OLD = ["PAPUA", "PAPUA BARAT"]
ipm = pd.concat([ipm[~ipm.xkey.duplicated(keep=False)],
                 dup[~dup.prov_excel.isin(OLD)]]).drop_duplicates("xkey")
log(f"[IPM] setelah deduplikasi: {len(ipm)} kab/kota")
pm["xkey"] = pm.nama_excel.map(squash)

def to_geo_key(x): return KAB_ALIAS.get(x, x)
kab = geo.copy()
kab["provinsi_analisis_tmp"] = kab.prov_analisis
for name, df, col in [("IPM", ipm, "ipm"), ("Penduduk miskin", pm, "jml_miskin")]:
    df = df.copy(); df["gkey"] = df.xkey.map(to_geo_key)
    # pencocokan nama + validasi: kunci gkey harus unik di kedua sisi, kecuali 'sorong'/'kotasorong' dsb.
    assert df.gkey.is_unique, df.gkey[df.gkey.duplicated()].tolist()
    merged = kab.merge(df[["gkey", col]], on="gkey", how="left")
    miss_geo = merged[col].isna().sum()
    unmatched_excel = sorted(set(df.gkey) - set(geo.gkey))
    log(f"[Join {name}] fitur peta tanpa nilai: {miss_geo}; baris Excel tanpa pasangan di peta: {unmatched_excel}")
    kab = merged

# ---------- 3. Tabel provinsi ----------
def prov_table(sheet, cols):
    df = raw[sheet].dropna(how="all").dropna(axis=1, how="all").copy()
    df.columns = ["provinsi"] + cols
    df["pk"] = df.provinsi.map(pkey)
    for c in cols: df[c] = df[c].map(num)
    return df.set_index("pk")
P = {
 "p0":    prov_table("P0",   ["p0_desa", "p0_kota", "p0"]),
 "gini":  prov_table("Gini", ["gini_kota", "gini_desa", "gini"]),
 "uhh":   prov_table("UHH",  ["uhh"]),
 "hls":   prov_table("HLS",  ["hls"]),
 "rls":   prov_table("RLS",  ["rls"]),
 "peng":  prov_table("Pengeluaran", ["pengeluaran_raw"]),
 "tpt":   prov_table("TPT",  ["tpt_feb", "tpt_agu"]),
 "tpak":  prov_table("TPAK", ["tpak_feb", "tpak_agu"]),
}
base = P["gini"].index.tolist()          # 34 provinsi + INDONESIA
nas = "indonesia"
prov = pd.DataFrame(index=[k for k in base if k != nas])
prov["provinsi"] = P["gini"].provinsi
for key, df in P.items():
    for c in df.columns.drop("provinsi"):
        prov[c] = df[c].reindex(prov.index)
nat = {c: df.loc[nas, c] for key, df in P.items() for c in df.columns.drop("provinsi") if nas in df.index}
# Pengeluaran: Excel membaca '10.334' (format ID, ribu) sebagai 10,334 -> kalikan 1000
assert prov.pengeluaran_raw.max() < 100
prov["pengeluaran"] = (prov.pengeluaran_raw * 1000).round(0)
log("[Pengeluaran] komponen IPM \"Pengeluaran per Kapita Riil per Tahun yang Disesuaikan\" (ribu Rp/orang/tahun). Nilai tersimpan sebagai pecahan (mis. 10.334) karena pemisah ribuan Indonesia terbaca sebagai desimal; dikalikan 1000 -> ribu Rp/orang/tahun. Nilai nasional 11.899 -> 11899.")
prov = prov.drop(columns="pengeluaran_raw")
log(f"[Provinsi] baris dipakai: {len(prov)} (batas provinsi lama, sebelum pemekaran Papua); 4 provinsi baru bernilai '-' di P0/TPT/TPAK dan tidak ada di sheet lain")
log("[TPAK] sheet memuat judul kolom ganda 'TPAK Februari 2023'. Sesuai pengecekan ke tabel asli BPS: kolom pertama = Februari, kolom kedua = Agustus. Kolom diberi nama tpak_feb dan tpak_agu.")
na_cnt = prov.isna().sum(); na_cnt = na_cnt[na_cnt > 0]
log(f"[Provinsi] nilai kosong per kolom: {na_cnt.to_dict()}; provinsi terkait: " + str({c: prov.provinsi[prov[c].isna()].tolist() for c in na_cnt.index}))

# kode provinsi turunan dari kode kab/kota di GeoJSON (modus awalan) -> verifikasi manual dengan kode resmi BPS
pref = geo.groupby("prov_analisis").kode_prov.agg(lambda s: s.value_counts().index[0])
prov["nama_geo"] = None
geo_pk = {pkey(p): p for p in geo.prov_analisis.unique()}
prov["nama_geo"] = [geo_pk.get(k) for k in prov.index]
log(f"[Provinsi] provinsi tanpa pasangan di peta: {prov.index[prov.nama_geo.isna()].tolist()}")
prov["kode_prov"] = prov.nama_geo.map(pref)
log(f"[Provinsi] kode provinsi ganda: {prov.kode_prov[prov.kode_prov.duplicated(keep=False)].to_dict()}")

# ---------- 4. Validasi silang ----------
sums = kab.groupby("provinsi_analisis_tmp")["jml_miskin"].sum()
rows = []
for p_excel, v in pm_prov.items():
    name = {pkey(x): x for x in geo.prov_analisis.unique()}.get(pkey(p_excel))
    if name and not np.isnan(v): rows.append((name, v, round(sums.get(name, np.nan), 2)))
cmp = pd.DataFrame(rows, columns=["prov", "baris_provinsi_excel", "jumlah_kabkota"])
cmp["selisih"] = (cmp.jumlah_kabkota - cmp.baris_provinsi_excel).round(2)
bad = cmp[cmp.selisih.abs() > 0.5]
log(f"[Validasi] jumlah penduduk miskin kab/kota vs baris provinsi: {len(cmp)} provinsi dicek; selisih > 0,5 ribu jiwa: {bad.to_dict('records')}")

# rentang nilai
rng = {"ipm": (0, 100), "p0": (0, 100), "gini": (0, 1), "tpt_feb": (0, 100), "tpak_feb": (0, 100)}
for c, (lo, hi) in rng.items():
    s = prov[c] if c in prov else kab[c]
    log(f"[Rentang] {c}: min {s.min():.3f}, maks {s.max():.3f} -> {'OK' if s.min() >= lo and s.max() <= hi else 'DI LUAR RENTANG'}")
kab_ipm = kab.ipm
log(f"[Rentang] ipm kab/kota: min {kab_ipm.min():.2f}, maks {kab_ipm.max():.2f}, kosong {kab_ipm.isna().sum()}")

# pencilan (|z| > 2,5) untuk 8 variabel analisis
VARS = ["p0", "gini", "uhh", "hls", "rls", "pengeluaran", "tpt_feb", "tpak_feb"]
z = (prov[VARS] - prov[VARS].mean()) / prov[VARS].std(ddof=0)
out = [(prov.provinsi[i], v, round(z.loc[i, v], 2)) for i in z.index for v in VARS if abs(z.loc[i, v]) > 2.5]
log(f"[Pencilan univariat |z|>2,5]: {out}")

# IPM provinsi (batas baru, 38 provinsi) dari baris provinsi pada sheet IPM
newprov = {pkey(x): x for x in geo.prov.unique()}
pb = pd.DataFrame([(newprov[pkey(p)], v) for p, v in ipm_prov.items()], columns=["provinsi", "ipm"])
assert len(pb) == 38 and pb.ipm.notna().all()
pb.to_csv(OUT + "provinsi_baru_ipm_2023.csv", index=False)
log(f"[IPM provinsi] {len(pb)} provinsi (batas baru) disimpan untuk node hierarki")

# ---------- 5. Simpan ----------
kab["prov_baru"] = kab.prov
kab_out = kab[["kode", "kode_prov", "nama", "prov", "prov_analisis", "kota", "ipm", "jml_miskin"]].rename(
    columns={"kode": "kode_kabkota", "nama": "nama_kabkota", "prov": "provinsi", "prov_analisis": "provinsi_analisis"})
kab_out.to_csv(OUT + "kabkota_2023.csv", index=False)
prov_out = prov.reset_index(drop=True)[["kode_prov", "provinsi", "nama_geo", "p0", "p0_desa", "p0_kota", "gini", "gini_desa", "gini_kota",
                                        "uhh", "hls", "rls", "pengeluaran", "tpt_feb", "tpt_agu", "tpak_feb", "tpak_agu"]]
prov_out.to_csv(OUT + "provinsi_2023.csv", index=False)
g["features"] = feats
json.dump(g, open(OUT + "kabkota_clean.geojson", "w"))
open(OUT + "data_issues.md", "w").write("# Catatan masalah data dan perbaikan\n\n" + "\n".join("- " + m for m in issues))
print("selesai")
