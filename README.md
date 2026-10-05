# Visualisasi Kesejahteraan dan Ketimpangan Wilayah Indonesia 2023

Aplikasi web interaktif untuk mengeksplorasi kondisi kesejahteraan dan ketimpangan wilayah di Indonesia berdasarkan data tahun 2023. Aplikasi menyajikan visualisasi pada tingkat provinsi serta kabupaten/kota menggunakan sejumlah indikator sosial-ekonomi.

## Demo

**Aplikasi web:**  
`https://rizalfn.github.io/uas-visualisasidata/`


## Tujuan

Proyek ini dibuat sebagai media visualisasi interaktif untuk membantu memahami variasi kesejahteraan antarwilayah di Indonesia.

Pengguna dapat mengeksplorasi indikator melalui tabel, grafik, heatmap, dan peta interaktif.

## Indikator

Indikator yang digunakan dalam proyek mencakup, sesuai ketersediaan data:

- Indeks Pembangunan Manusia (IPM)
- Persentase penduduk miskin
- Gini Ratio
- Tingkat Pengangguran Terbuka (TPT)
- Tingkat Partisipasi Angkatan Kerja (TPAK)
- Umur Harapan Hidup (UHH)
- Harapan Lama Sekolah (HLS)
- Rata-rata Lama Sekolah (RLS)
- Pengeluaran per kapita

Tidak semua indikator tersedia pada tingkat wilayah yang sama.

## Teknologi

Aplikasi merupakan web statis yang menggunakan:

- **HTML5** — struktur halaman
- **CSS3** — tampilan dan layout
- **JavaScript** — interaksi dan pengolahan data pada sisi klien
- **Plotly.js** — visualisasi data interaktif
- **GeoJSON** — data geometri wilayah
- **GitHub Pages** — deployment aplikasi

Aplikasi tidak memerlukan backend untuk ditampilkan kepada pengguna.

## Struktur Repository

```text
bps-kesejahteraan-wilayah2/
  index.html
  app/
    app.js
    style.css
    vendor/
      PLOTLY_LICENSE.txt
      plotly.min.js
  data/
    processed/
      data_issues.md
      heatmap_order_2023.json
      hierarki_2023.csv
      kabkota.geojson
      kabkota_2023.csv
      kabkota_app_2023.csv
      pca_loadings_2023.csv
      pca_provinsi_2023.csv
      pca_varians_2023.csv
      provinsi_2023.csv
      provinsi_baru_ipm_2023.csv
      ringkasan_2023.json
      zscore_provinsi_2023.csv
    raw/
      SOURCES.md
      visualisasi_bps.xlsx
  scripts/
    01_clean.py
    02_simplify_geo.py
    03_features.py
```

## Data

### Periode

Data utama yang digunakan dalam aplikasi mengacu pada **tahun 2023**.

### Sumber Data

Sumber data utama adalah **Badan Pusat Statistik (BPS)**. Dokumentasi sumber dan keterangan data tersedia pada:

`data/raw/SOURCES.md`

Data mentah yang digunakan dalam proses pengolahan disimpan pada folder `data/raw/`.

### Data Terolah

Dataset yang digunakan langsung oleh aplikasi disimpan pada:

`data/processed/`

Folder tersebut berisi antara lain dataset tingkat provinsi/kabupaten-kota, hasil standardisasi, output PCA, ringkasan data, dan data spasial.

## Pengolahan Data

Proyek menyediakan script Python pada folder `scripts/` untuk proses pengolahan data.

Secara umum prosesnya meliputi:

1. Pembersihan dan standardisasi data.
2. Penyesuaian nama serta kode wilayah.
3. Pemrosesan dan penyederhanaan geometri wilayah.
4. Pembentukan fitur/dataset yang digunakan oleh aplikasi.
5. Penyimpanan hasil pengolahan ke folder `data/processed/`.

## Analisis PCA

Proyek juga menyediakan hasil **Principal Component Analysis (PCA)** untuk merangkum variasi beberapa indikator kesejahteraan.

Output PCA mencakup:

- skor PCA tingkat provinsi;
- loading masing-masing indikator;
- proporsi/varians yang dijelaskan oleh komponen utama.

File hasil PCA disimpan di `data/processed/`.

## Visualisasi

Aplikasi menyediakan visualisasi interaktif yang mencakup:

- peta persebaran indikator;
- perbandingan antarwilayah;
- heatmap;
- visualisasi indikator kesejahteraan;
- eksplorasi wilayah provinsi dan kabupaten/kota;
- visualisasi hasil analisis PCA.

Visualisasi dijalankan di browser menggunakan Plotly.js.

## Catatan Kualitas Data

Selama pengolahan dilakukan pemeriksaan terhadap konsistensi data, termasuk kode/nama wilayah, duplikasi, format angka, serta kesesuaian data spasial.

Catatan masalah dan penyesuaian data didokumentasikan pada:

`data/processed/data_issues.md`

## Batasan

1. Data utama menggunakan periode tahun 2023 sehingga tidak dimaksudkan sebagai representasi kondisi terkini.
2. Tidak semua indikator tersedia pada tingkat wilayah yang sama.
3. Beberapa indikator tersedia pada tingkat provinsi, sementara indikator tertentu tersedia pada tingkat kabupaten/kota.
4. Struktur wilayah dapat mengalami perubahan akibat pemekaran sehingga pencocokan data perlu memperhatikan kode dan hierarki wilayah.
5. Data spasial perlu digunakan sesuai sumber dan ketentuan lisensi penyedianya.
6. Hasil PCA bergantung pada indikator, standardisasi, dan data yang digunakan dalam analisis.

## Menjalankan Secara Lokal

Karena aplikasi merupakan web statis, aplikasi dapat dijalankan melalui web server lokal.

Contoh menggunakan Python:

```bash
python -m http.server 8000
```

Kemudian buka:

```text
http://localhost:8000
```

Jalankan perintah tersebut dari folder yang berisi `index.html`.

Menjalankan melalui web server lokal lebih disarankan daripada membuka `index.html` secara langsung karena browser dapat membatasi akses JavaScript terhadap file data lokal.

## Deployment

Aplikasi dideploy menggunakan **GitHub Pages**.

Konfigurasi yang digunakan:

- Repository: **Public**
- Branch: `main`
- Folder: `/ (root)`
- Platform: **GitHub Pages**

Setelah GitHub Pages aktif, aplikasi dapat diakses publik melalui browser tanpa login maupun instalasi.

## Lisensi dan Atribusi

Kode proyek digunakan untuk keperluan akademik.

Data yang berasal dari BPS tetap mengikuti ketentuan penggunaan dan atribusi BPS. Data spasial dari pihak ketiga mengikuti lisensi dan ketentuan penggunaan dari penyedia data tersebut.

Untuk rincian sumber data, lihat:

`data/raw/SOURCES.md`

## Kredit

**Sumber data utama:** Badan Pusat Statistik (BPS)  
**Library visualisasi:** Plotly.js  
**Platform deployment:** GitHub Pages  
**Periode data:** 2023
