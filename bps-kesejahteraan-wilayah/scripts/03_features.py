"""03_features.py - Fitur analisis: PCA, klaster, urutan heatmap, tabel hierarki, titik simbol peta.
Jalankan dari root repo setelah 01 dan 02:  python scripts/03_features.py
Pilihan periode Sakernas (TPT, TPAK) diatur di PERIODE_KERJA ('agu' atau 'feb').
"""
import json
import numpy as np, pandas as pd
from scipy.cluster.hierarchy import linkage, leaves_list
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, adjusted_rand_score
from shapely.geometry import shape

PERIODE_KERJA = "agu"            # Agustus: lihat docs/methodology.md untuk alasan
P = "data/processed/"
SEED = 42

prov = pd.read_csv(P + "provinsi_2023.csv", dtype={"kode_prov": str})
kab = pd.read_csv(P + "kabkota_2023.csv", dtype={"kode_kabkota": str, "kode_prov": str})
pbaru = pd.read_csv(P + "provinsi_baru_ipm_2023.csv")

# ---------- kelompok pulau (dibuat sendiri; BUKAN data BPS) ----------
PULAU = {
 "Sumatera": ["Aceh","Sumatera Utara","Sumatera Barat","Riau","Jambi","Sumatera Selatan","Bengkulu","Lampung","Kepulauan Bangka Belitung","Kepulauan Riau"],
 "Jawa": ["DKI Jakarta","Jawa Barat","Jawa Tengah","Daerah Istimewa Yogyakarta","Jawa Timur","Banten"],
 "Bali & Nusa Tenggara": ["Bali","Nusa Tenggara Barat","Nusa Tenggara Timur"],
 "Kalimantan": ["Kalimantan Barat","Kalimantan Tengah","Kalimantan Selatan","Kalimantan Timur","Kalimantan Utara"],
 "Sulawesi": ["Sulawesi Utara","Sulawesi Tengah","Sulawesi Selatan","Sulawesi Tenggara","Sulawesi Barat","Gorontalo"],
 "Maluku": ["Maluku","Maluku Utara"],
 "Papua": ["Papua Barat","Papua Barat Daya","Papua","Papua Selatan","Papua Tengah","Papua Pegunungan"],
}
p2pulau = {p: k for k, v in PULAU.items() for p in v}
assert len(p2pulau) == 38 and set(kab.provinsi) <= set(p2pulau), set(kab.provinsi) - set(p2pulau)
kab["pulau"] = kab.provinsi.map(p2pulau)
prov["pulau"] = prov.nama_geo.map(p2pulau)
assert prov.pulau.notna().all()

# ---------- 8 variabel analisis ----------
VARS = {"p0": "P0", "gini": "Gini", "uhh": "UHH", "hls": "HLS", "rls": "RLS", "pengeluaran": "Pengeluaran",
        "tpt": "TPT", "tpak": "TPAK"}
def build(periode):
    d = prov.copy()
    d["tpt"] = d[f"tpt_{periode}"]; d["tpak"] = d[f"tpak_{periode}"]
    return d
def zscore(d): X = d[list(VARS)]; return (X - X.mean()) / X.std(ddof=0)
def pca(Z):
    U, S, Vt = np.linalg.svd(Z.values, full_matrices=False)
    var = S**2 / (len(Z) - 0); ratio = var / var.sum()
    scores = U * S
    # tanda komponen dibuat deterministik: elemen |loading| terbesar bernilai positif
    for i in range(Vt.shape[0]):
        if Vt[i, np.argmax(np.abs(Vt[i]))] < 0: Vt[i] *= -1; scores[:, i] *= -1
    return scores, Vt, ratio
def best_k(Z, ks=range(2, 7)):
    res = {}
    for k in ks:
        km = KMeans(n_clusters=k, n_init=50, random_state=SEED).fit(Z)
        res[k] = (silhouette_score(Z, km.labels_), km.labels_)
    return res

d = build(PERIODE_KERJA); Z = zscore(d)
scores, load, ratio = pca(Z)
sil = best_k(Z)
print("Silhouette per k:", {k: round(v[0], 3) for k, v in sil.items()})
K = max(range(3, 7), key=lambda k: sil[k][0])   # k terbaik dengan silhouette tertinggi di antara k >= 3 (k=2 terlalu kasar untuk menafsirkan kelompok)
km = KMeans(n_clusters=K, n_init=50, random_state=SEED).fit(Z)
# beri nomor klaster berurutan menurut rata-rata P0 (klaster 1 = P0 terendah) agar stabil dan mudah dibaca
order = d.assign(l=km.labels_).groupby("l").p0.mean().sort_values().index.tolist()
remap = {old: new + 1 for new, old in enumerate(order)}
d["klaster"] = [remap[l] for l in km.labels_]
print("Ukuran klaster:", d.klaster.value_counts().sort_index().to_dict(), "| varians PC1-3:", np.round(ratio[:3], 3))

# ---------- uji sensitivitas Februari vs Agustus ----------
sens = {}
for per in ("feb", "agu"):
    dd = build(per); Zd = zscore(dd)
    km_ = KMeans(n_clusters=K, n_init=50, random_state=SEED).fit(Zd)
    sens[per] = (dd, km_.labels_)
ari = adjusted_rand_score(sens["feb"][1], sens["agu"][1])
cor_tpt = np.corrcoef(prov.tpt_feb, prov.tpt_agu)[0, 1]; cor_tpak = np.corrcoef(prov.tpak_feb, prov.tpak_agu)[0, 1]
print(f"Sensitivitas: korelasi TPT feb-agu = {cor_tpt:.3f}; TPAK feb-agu = {cor_tpak:.3f}; ARI klaster feb vs agu = {ari:.3f}")

# ---------- keluaran ----------
out = d[["kode_prov", "provinsi", "pulau", "klaster"] + list(VARS)].copy()
for i in range(3): out[f"pc{i+1}"] = scores[:, i]
out.to_csv(P + "pca_provinsi_2023.csv", index=False)
pd.DataFrame(load[:3].T, index=list(VARS), columns=["pc1", "pc2", "pc3"]).rename_axis("variabel").to_csv(P + "pca_loadings_2023.csv")
pd.DataFrame({"komponen": [f"PC{i+1}" for i in range(len(ratio))], "porsi_varians": ratio}).to_csv(P + "pca_varians_2023.csv", index=False)

# urutan baris & kolom heatmap: pengelompokan hierarkis (Ward untuk provinsi, 1 - korelasi untuk variabel)
row_order = leaves_list(linkage(Z.values, method="ward"))
cc = 1 - np.corrcoef(Z.values.T); np.fill_diagonal(cc, 0)
from scipy.spatial.distance import squareform
col_order = leaves_list(linkage(squareform(np.clip(cc, 0, None), checks=False), method="average"))
json.dump({"baris": [d.provinsi.iloc[i] for i in row_order], "kolom": [list(VARS)[i] for i in col_order]},
          open(P + "heatmap_order_2023.json", "w"), ensure_ascii=False)
Zout = Z.copy(); Zout.insert(0, "provinsi", d.provinsi.values); Zout.to_csv(P + "zscore_provinsi_2023.csv", index=False)

# ---------- hierarki: Indonesia > pulau > provinsi > kab/kota ----------
rows = [("Indonesia", "", "Indonesia", 0, np.nan, np.nan)]
for pu in PULAU: rows.append((f"Indonesia|{pu}", "Indonesia", pu, 1, np.nan, np.nan))
kab["tot"] = kab.jml_miskin
for pr, g in kab.groupby("provinsi"):
    pu = p2pulau[pr]; ip = pbaru.set_index("provinsi").ipm[pr]
    rows.append((f"Indonesia|{pu}|{pr}", f"Indonesia|{pu}", pr, 2, round(g.jml_miskin.sum(), 2), ip))
for _, r in kab.iterrows():
    pu = p2pulau[r.provinsi]
    rows.append((f"Indonesia|{pu}|{r.provinsi}|{r.kode_kabkota}", f"Indonesia|{pu}|{r.provinsi}", r.nama_kabkota, 3, r.jml_miskin, r.ipm))
H = pd.DataFrame(rows, columns=["id", "parent", "label", "level", "jml_miskin", "ipm"])
# nilai induk = jumlah anak (syarat treemap branchvalues='total')
for lvl in (2, 1, 0):
    for pid, s in H[H.level == lvl + 1].groupby("parent").jml_miskin.sum().items():
        H.loc[H.id == pid, "jml_miskin"] = round(s, 2)
H.to_csv(P + "hierarki_2023.csv", index=False)
print("Hierarki:", H.level.value_counts().sort_index().to_dict(), "| total penduduk miskin (ribu jiwa):", H.jml_miskin[H.level == 0].iloc[0])

# ---------- titik simbol proporsional + peta kab/kota ----------
g = json.load(open(P + "kabkota.geojson"))
pts = {f["properties"]["kode"]: shape(f["geometry"]).representative_point() for f in g["features"]}
kab["lon"] = kab.kode_kabkota.map(lambda k: round(pts[k].x, 4)); kab["lat"] = kab.kode_kabkota.map(lambda k: round(pts[k].y, 4))
kode_analisis = prov.set_index("nama_geo").kode_prov
kab["kode_prov_analisis"] = kab.provinsi_analisis.map(kode_analisis)
assert kab.kode_prov_analisis.notna().all()
kab.drop(columns="tot")[["kode_kabkota", "nama_kabkota", "provinsi", "provinsi_analisis", "kode_prov_analisis", "pulau", "kota", "ipm", "jml_miskin", "lon", "lat"]]\
   .to_csv(P + "kabkota_app_2023.csv", index=False)

# profil klaster dan pencilan (deskriptif)
print(out.groupby("klaster")[list(VARS)].mean().round(2).to_string())
for k, gg in out.groupby("klaster"): print(k, gg.provinsi.tolist())
dist = np.sqrt((scores[:, :2]**2).sum(1)); top = np.argsort(-dist)[:5]
print("Terjauh dari pusat (PC1-PC2):", [(d.provinsi.iloc[i], round(dist[i], 2)) for i in top])

# ---------- ringkasan parameter analisis (dipakai halaman web dan dokumentasi) ----------
json.dump({"periode_kerja": PERIODE_KERJA, "k": int(K), "silhouette_per_k": {int(k): round(float(v[0]), 3) for k, v in sil.items()},
           "varians": [round(float(x), 4) for x in ratio], "ari_feb_vs_agu": round(float(ari), 3),
           "korelasi_tpt_feb_agu": round(float(cor_tpt), 3), "korelasi_tpak_feb_agu": round(float(cor_tpak), 3),
           "n_provinsi": int(len(d)), "n_kabkota": int(len(kab)), "seed": SEED},
          open(P + "ringkasan_2023.json", "w"), indent=1)
