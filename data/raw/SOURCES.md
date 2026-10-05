# Sumber data (tahun data 2023; seluruh sumber BPS diakses 2 Oktober 2026)

File mentah: `visualisasi_bps.xlsx` (disusun penulis dari tabel/publikasi BPS di bawah; satu sheet per tabel).

| Sheet | Variabel | Tingkat | Sumber BPS |
|-----------------|------------------|-----------------|--------------------|
| IPM | IPM 2023 | kab/kota | <https://www.bps.go.id/id/statistics-table/2/NDEzIzI=/-metode-baru-indeks-pembangunan-manusia-menurut-provinsi.html> (isi tabel: kab/kota, dikonfirmasi penulis) |
| Jumlah Penduduk | Jumlah penduduk miskin (ribu jiwa) | kab/kota | <https://www.bps.go.id/id/statistics-table/2/NjE5IzI=/jumlah-penduduk-miskin--ribu-jiwa--menurut-kabupaten-kota-.html> |
| P0 | Persentase penduduk miskin, Maret 2023 | provinsi | <https://www.bps.go.id/id/statistics-table/2/MTkyIzI=/persentase-penduduk-miskin-menurut-provinsi.html> |
| Gini | Gini ratio, Maret 2023 | provinsi | <https://www.bps.go.id/id/statistics-table/2/OTgjMg==/gini-ratio-menurut-provinsi-dan-daerah.html> |
| UHH, HLS, RLS, Pengeluaran | Komponen IPM 2023; pengeluaran = Pengeluaran per Kapita Riil per Tahun yang Disesuaikan | provinsi | Publikasi "Indeks Pembangunan Manusia 2023" (BPS, rilis 13 Mei 2024, katalog 4102002, no. publikasi 07300.24008), Lampiran 2, halaman 138. <https://www.bps.go.id/id/publication/2024/05/13/8f77e73a66a6f484c655985a/indeks-pembangunan-manusia-2023.html> |
| TPT | TPT Februari dan Agustus 2023 | provinsi | <https://www.bps.go.id/id/statistics-table/2/NTQzIzI=/tingkat-pengangguran-terbuka-menurut-provinsi.html> |
| TPAK | TPAK Februari dan Agustus 2023 (header sheet dobel; kolom 2 = Februari, kolom 3 = Agustus, dikonfirmasi penulis) | provinsi | <https://www.bps.go.id/id/statistics-table/2/MjM5NiMy/persentase-angkatan-kerja-terhadap-penduduk-usia-kerja--tpak--menurut-provinsi.html> |

## Data pendukung non-BPS

- Batas wilayah digital kab/kota (`kabkota.geojson`): diunduh dari Lapak GIS. https://www.lapakgis.com/2022/01/shp-batas-kabupaten-kota-indonesia.html (diakses 2 Okt. 2026). Situs mengizinkan penggunaan kembali dengan atribusi yang sesuai.
- Pengelompokan pulau/wilayah (7 kelompok) dibuat penulis, bukan klasifikasi resmi BPS.
