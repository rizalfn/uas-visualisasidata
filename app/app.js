/* Dasbor Kesejahteraan dan Ketimpangan Wilayah, BPS 2023.
 * Struktur berkas: 1) konfigurasi  2) muat data  3) status pilihan + penghubung antar tampilan
 *                  4) V1-V5  5) temuan, metodologi, sumber  6) inisialisasi
 * Semua angka dibaca dari data/processed/ (hasil scripts/01-03). Tidak ada angka yang ditulis tangan di sini. */
(() => {
'use strict';

/* ---------- 1. KONFIGURASI ---------- */
const PATH = 'data/processed/';
const TAHUN = 2023;
const AKSES = '2 Oktober 2026';
const IPM_NASIONAL = 74.39;   // IPM Indonesia 2023, BPS: Publikasi Indeks Pembangunan Manusia 2023

// Palet ramah buta warna: kategori (klaster), biru-teal (berurutan), biru-jingga (divergen)
const PAL = {
  // Klaster: violet, merah muda, mustard. Sengaja di luar biru-teal (IPM) dan jingga (lingkaran, heatmap) agar warna tidak bermakna ganda. Lolos uji buta warna.
  klaster: ['#CC79A7', '#6B4FA3', '#9C8B00', '#56B4E9', '#E69F00'],
  ipm: ['#c2e4e6', '#72b8c8', '#2b7fa5', '#0b2f55'],   // berurutan, satu keluarga biru-teal: terang = rendah, gelap = tinggi
  // Treemap dan sunburst: empat warna berbeda (bukan gradasi), urut Rendah, Sedang, Tinggi, Sangat tinggi. Lolos uji buta warna (selisih CVD >= 11).
  ipmHier: ['#D55E00', '#E69F00', '#56B4E9', '#009E73'],
  peta1: '#c8d1da',   // peta satu warna saat layer IPM dimatikan
  simbol: '#D55E00',
  netral: '#b8c0c8',
  div: [[0, '#0072B2'], [0.5, '#f7f7f7'], [1, '#D55E00']],
};
// Kelas IPM mengikuti ambang BPS
const KELAS = ['Rendah (<60)', 'Sedang (60–<70)', 'Tinggi (70–<80)', 'Sangat tinggi (≥80)'];
const kelasIpm = v => (v < 60 ? 0 : v < 70 ? 1 : v < 80 ? 2 : 3);
const SIMBOL = { 'Sumatera': 'circle', 'Jawa': 'square', 'Bali & Nusa Tenggara': 'diamond', 'Kalimantan': 'triangle-up',
                 'Sulawesi': 'pentagon', 'Maluku': 'hexagon', 'Papua': 'star' };
const GLYPH = { circle: '●', square: '■', diamond: '◆', 'triangle-up': '▲', pentagon: '⬟', hexagon: '⬢', star: '★' };

const SUMBER = {
  ipm:   { nama: 'IPM (Metode Baru) menurut kabupaten/kota', url: 'https://www.bps.go.id/id/statistics-table/2/NDEzIzI=/-metode-baru-indeks-pembangunan-manusia-menurut-provinsi.html' },
  miskin:{ nama: 'Jumlah penduduk miskin menurut kabupaten/kota', url: 'https://www.bps.go.id/id/statistics-table/2/NjIxIzI=/persentase-penduduk-miskin-menurut-kabupaten-kota.html' },
  p0:    { nama: 'Persentase penduduk miskin menurut provinsi', url: 'https://www.bps.go.id/id/statistics-table/2/MTkyIzI=/persentase-penduduk-miskin-menurut-provinsi.html' },
  gini:  { nama: 'Gini ratio menurut provinsi dan daerah', url: 'https://www.bps.go.id/id/statistics-table/2/OTgjMg==/gini-ratio-menurut-provinsi-dan-daerah.html' },
  pub:   { nama: 'Publikasi Indeks Pembangunan Manusia 2023', url: 'https://www.bps.go.id/id/publication/2024/05/13/8f77e73a66a6f484c655985a/indeks-pembangunan-manusia-2023.html' },
  tpt:   { nama: 'Tingkat pengangguran terbuka menurut provinsi', url: 'https://www.bps.go.id/id/statistics-table/2/NTQzIzI=/tingkat-pengangguran-terbuka-menurut-provinsi.html' },
  tpak:  { nama: 'TPAK menurut provinsi', url: 'https://www.bps.go.id/id/statistics-table/2/MjM5NiMy/persentase-angkatan-kerja-terhadap-penduduk-usia-kerja--tpak--menurut-provinsi.html' },
};
const link = k => `<a href="${SUMBER[k].url}" target="_blank" rel="noopener">${SUMBER[k].nama}</a>`;
const caption = (satuan, tahunTxt, srcKeys, extra = '') =>
  `<b>Satuan:</b> ${satuan} · <b>Tahun data:</b> ${tahunTxt} · <b>Sumber:</b> BPS, ${srcKeys.map(link).join('; ')} (diakses ${AKSES}).${extra}`;
const CAP_BATAS = ' <b>Batas wilayah (data pendukung non-BPS):</b> Lapak GIS.';

const fmt = (v, d = 2) => Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const $ = id => document.getElementById(id);
const cfg = { responsive: true, displaylogo: false, scrollZoom: true, modeBarButtonsToRemove: ['sendDataToCloud'], topojsonURL: 'app/vendor/topojson/' };
const baseLayout = { font: { family: '"Plus Jakarta Sans", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif', size: 12, color: '#16222e' },
                     separators: ',.', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' };

let VARS = [];     // diisi setelah ringkasan dibaca (periode Sakernas ikut berkas ringkasan)

/* ---------- 2. MUAT DATA ---------- */
const STR_COLS = new Set(['kode_prov', 'kode_kabkota', 'kode_prov_analisis', 'provinsi', 'provinsi_analisis', 'pulau', 'nama_kabkota',
                          'id', 'parent', 'label', 'nama_geo', 'variabel', 'komponen']);
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => {
    const v = r[i]; return [h, STR_COLS.has(h) || v === '' || isNaN(Number(v)) ? v : Number(v)];
  })));
}
const getText = async n => { const r = await fetch(PATH + n); if (!r.ok) throw new Error(n + ' (' + r.status + ')'); return r.text(); };
const getCSV = async n => parseCSV(await getText(n));
const getJSON = async n => JSON.parse(await getText(n));

/* ---------- 3. STATUS PILIHAN + PENGHUBUNG ---------- */
const D = {};                 // semua data
const S = { sel: new Set(), K: 3 };   // sel = kode provinsi analisis (34 provinsi) yang dipilih

function setSelection(codes, source) {
  S.sel = new Set(codes);
  const idx = D.pca.map((r, i) => S.sel.has(r.kode_prov) ? i : -1).filter(i => i >= 0);
  const has = idx.length > 0;

  if (source !== 'pca') {
    Plotly.restyle('pca', { selectedpoints: [has ? idx : null] }, [0]);
    if (!has) Plotly.relayout('pca', { selections: [] });
  }
  if (source !== 'par') Plotly.restyle('par', { 'line.color': [parColors()] }, [0]);
  if (source !== 'heat' || true) drawHeatSelection();
  drawMapSelection();

  if (source !== 'filter') { $('f-pulau').value = ''; $('f-klaster').value = ''; }
  const names = D.pca.filter(r => S.sel.has(r.kode_prov)).map(r => r.provinsi);
  $('sel-info').textContent = has
    ? `${names.length} provinsi dipilih: ${names.join(', ')}.`
    : 'Belum ada provinsi dipilih. Pilih dengan kotak/lasso pada grafik PCA, garis pada sumbu paralel, baris heatmap, atau klik wilayah di peta. Semua tampilan saling terhubung.';
  drawHeroSelection(); drawRangeSelection(); drawSelPanel();
}
window.APP = { setSelection, S, D };   // untuk pengujian

/* ---------- 4a. V1 PCA biplot ---------- */
function drawPCA() {
  const rows = D.pca, K = S.K;
  const maxAbs = Math.max(...rows.flatMap(r => [Math.abs(r.pc1), Math.abs(r.pc2)]));
  const maxLoad = Math.max(...D.loadings.flatMap(l => [Math.abs(l.pc1), Math.abs(l.pc2)]));
  const scale = 0.85 * maxAbs / maxLoad;
  // Panah: ekor di titik asal (0,0), kepala di posisi loading. Teks panah dikosongkan karena
  // Plotly menaruh teks di ekor; label ditaruh terpisah di ujung panah.
  const arrows = D.loadings.map(l => ({
    x: l.pc1 * scale, y: l.pc2 * scale, ax: 0, ay: 0, xref: 'x', yref: 'y', axref: 'x', ayref: 'y',
    showarrow: true, arrowhead: 2, arrowsize: 1, arrowwidth: 1.3, arrowcolor: '#52606d', text: '', name: 'panah', captureevents: false,
  }));
  const labels = D.loadings.map(l => ({
    x: l.pc1 * scale * 1.06, y: l.pc2 * scale * 1.06, xref: 'x', yref: 'y', showarrow: false,
    text: VARS.find(v => v.k === l.variabel).short, font: { size: 11, color: '#3e4c59' },
    xanchor: l.pc1 >= 0 ? 'left' : 'right', yanchor: l.pc2 >= 0 ? 'bottom' : 'top', name: 'label-panah', captureevents: false,
  }));
  const ann = [...arrows, ...labels];
  const tr = {
    type: 'scatter', mode: 'markers', x: rows.map(r => r.pc1), y: rows.map(r => r.pc2),
    marker: { size: 12, color: rows.map(r => PAL.klaster[r.klaster - 1]), symbol: rows.map(r => SIMBOL[r.pulau]),
              line: { width: 1, color: '#1f2933' }, opacity: 0.95 },
    selected: { marker: { opacity: 1, size: 14 } }, unselected: { marker: { opacity: 0.18 } },
    customdata: rows.map(r => [r.pulau, r.klaster, ...VARS.map(v => r[v.k])]),
    hovertemplate: '<b>%{text}</b><br>Pulau: %{customdata[0]}<br>Klaster: %{customdata[1]}<br>' +
      VARS.map((v, i) => `${v.short}: %{customdata[${i + 2}]:,.${v.d}f} ${v.unit}`).join('<br>') + '<extra></extra>',
    text: rows.map(r => r.provinsi), showlegend: false,
  };
  const v = D.ringkasan.varians;
  const layout = { ...baseLayout, dragmode: 'select', margin: { l: 60, r: 15, t: 10, b: 55 },
    xaxis: { automargin: true, title: { text: `PC1 (${fmt(v[0] * 100, 1)}% varians)` }, zeroline: true, zerolinecolor: '#9aa5b1', gridcolor: '#eceff2' },
    yaxis: { automargin: true, title: { text: `PC2 (${fmt(v[1] * 100, 1)}% varians)` }, zeroline: true, zerolinecolor: '#9aa5b1', gridcolor: '#eceff2' },
    annotations: $('t-arrows').checked ? ann : [], hovermode: 'closest' };
  Plotly.newPlot('pca', [tr], layout, cfg).then(gd => {
    gd.on('plotly_selected', ev => {
      if (!ev || !ev.points) return;
      setSelection(ev.points.map(p => D.pca[p.pointIndex].kode_prov), 'pca');
    });
    gd.on('plotly_deselect', () => setSelection([], 'pca'));
  });
  D._pcaAnn = ann;

  // legenda klaster dan pulau (dapat diklik = memilih)
  const prof = clusterProfile();
  $('leg-klaster').innerHTML = prof.map(c =>
    `<button type="button" class="chip" data-k="${c.k}" aria-pressed="false" title="Pilih Klaster ${c.k}">
       <span class="dot" style="background:${PAL.klaster[c.k - 1]}"></span>Klaster ${c.k} <small>(${c.n}) · tinggi: ${c.hi}; rendah: ${c.lo}</small></button>`).join('');
  const pul = [...new Set(rows.map(r => r.pulau))];
  $('leg-pulau').innerHTML = pul.map(p => `<button type="button" class="chip" data-p="${p}" aria-pressed="false" title="Pilih pulau ${p}">
       <span aria-hidden="true">${GLYPH[SIMBOL[p]]}</span>${p} <small>(${rows.filter(r => r.pulau === p).length})</small></button>`).join('');
  $('leg-klaster').onclick = e => { const b = e.target.closest('[data-k]'); if (b) selectCluster(+b.dataset.k); };
  $('leg-pulau').onclick = e => { const b = e.target.closest('[data-p]'); if (b) selectPulau(b.dataset.p); };
  $('cap-pca').innerHTML = caption(
    'skor komponen utama (tanpa satuan) dari 8 indikator terstandardisasi (skor-z)', `2023 (P0 dan Gini: Maret 2023; TPT dan TPAK: ${D.periodeNama} 2023)`,
    ['p0', 'gini', 'pub', 'tpt', 'tpak']);
}

function clusterProfile() {
  const K = S.K, out = [];
  for (let k = 1; k <= K; k++) {
    const idx = D.pca.map((r, i) => r.klaster === k ? i : -1).filter(i => i >= 0);
    const zmean = VARS.map(v => idx.reduce((s, i) => s + D.z[i][v.k], 0) / idx.length);
    const order = zmean.map((z, i) => [z, i]).sort((a, b) => b[0] - a[0]);
    out.push({ k, n: idx.length, hi: VARS[order[0][1]].short, lo: VARS[order[order.length - 1][1]].short, idx,
               mean: Object.fromEntries(VARS.map(v => [v.k, idx.reduce((s, i) => s + D.pca[i][v.k], 0) / idx.length])),
               provs: idx.map(i => D.pca[i].provinsi) });
  }
  return out;
}
function selectCluster(k) { const c = D.pca.filter(r => r.klaster === k).map(r => r.kode_prov); $('f-klaster').value = String(k); $('f-pulau').value = ''; setSelection(c, 'filter'); }
function selectPulau(p) { const c = D.pca.filter(r => r.pulau === p).map(r => r.kode_prov); $('f-pulau').value = p; $('f-klaster').value = ''; setSelection(c, 'filter'); }

/* ---------- 4b. V2 koordinat paralel ---------- */
function parColors() {
  // 0 = tidak terpilih (abu-abu), 1..K = klaster
  return D.pca.map(r => (S.sel.size === 0 || S.sel.has(r.kode_prov)) ? r.klaster : 0);
}
function drawPar() {
  const rows = D.pca, K = S.K;
  const cs = []; const cols = ['rgba(150,160,170,0.35)', ...PAL.klaster.slice(0, K)];
  cols.forEach((c, i) => { cs.push([i / (K + 1), c], [(i + 1) / (K + 1), c]); });
  const dims = VARS.map(v => {
    const vals = rows.map(r => r[v.k]); const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.04;
    return { label: `${v.short} (${v.unit.replace('ribu Rp/orang/tahun', 'ribu Rp')})`, values: vals, range: [lo - pad, hi + pad] };   // satu baris agar tidak menabrak nilai maksimum sumbu
  });
  const tr = { type: 'parcoords', dimensions: dims, line: { color: parColors(), colorscale: cs, cmin: -0.5, cmax: K + 0.5, showscale: false },
               labelfont: { size: 11 }, tickfont: { size: 10 }, rangefont: { size: 10 } };
  Plotly.newPlot('par', [tr], { ...baseLayout, margin: { l: 50, r: 55, t: 60, b: 20 } }, cfg).then(gd => {
    gd.on('plotly_restyle', ev => {
      const upd = ev && ev[0]; if (!upd || !Object.keys(upd).some(k => k.includes('constraintrange'))) return;
      const dd = gd.data[0].dimensions;
      const active = dd.map((d, i) => ({ i, cr: d.constraintrange })).filter(x => x.cr && x.cr.length);
      if (!active.length) { setSelection([], 'par'); return; }
      const norm = cr => (Array.isArray(cr[0]) ? cr : [cr]);
      const ok = rows.filter(r => active.every(({ i, cr }) => norm(cr).some(([a, b]) => r[VARS[i].k] >= a && r[VARS[i].k] <= b)));
      setSelection(ok.map(r => r.kode_prov), 'par');
    });
  });
  $('cap-par').innerHTML = caption(VARS.map(v => `${v.short} (${v.unit})`).join(', '),
    `2023 (P0 dan Gini: Maret 2023; TPT dan TPAK: ${D.periodeNama} 2023)`, ['p0', 'gini', 'pub', 'tpt', 'tpak'],
    ' Warna garis = klaster (sama dengan biplot PCA).');
}

/* ---------- 4c. V3 heatmap berklaster ---------- */
function drawHeat() {
  const order = D.heatOrder;
  const byName = Object.fromEntries(D.pca.map((r, i) => [r.provinsi, i]));
  const colKeys = order.kolom, rowNames = order.baris;
  const xLab = colKeys.map(k => VARS.find(v => v.k === k).short);
  const z = rowNames.map(n => colKeys.map(k => D.z[byName[n]][k]));
  const raw = rowNames.map(n => colKeys.map(k => D.pca[byName[n]][k]));
  const unit = colKeys.map(k => VARS.find(v => v.k === k));
  const tr = { type: 'heatmap', x: xLab, y: rowNames, z, customdata: raw, zmin: -3, zmax: 3, zmid: 0, colorscale: PAL.div,
               xgap: 1, ygap: 1, colorbar: { title: { text: 'skor-z', side: 'right' }, thickness: 12, len: 0.7 },
               hovertemplate: '<b>%{y}</b><br>%{x}: %{customdata:,.2f} (skor-z %{z:.2f})<extra></extra>' };
  const layout = { ...baseLayout, margin: { l: 130, r: 10, t: 10, b: 50 }, xaxis: { side: 'bottom', tickangle: -35, automargin: true, fixedrange: true },
                   yaxis: { autorange: 'reversed', automargin: true, tickfont: { size: 10 }, fixedrange: true }, shapes: [] };
  Plotly.newPlot('heat', [tr], layout, cfg).then(gd => {
    gd.on('plotly_click', ev => {
      const name = ev.points[0].y; const code = D.pca[byName[name]].kode_prov;
      setSelection(S.sel.size === 1 && S.sel.has(code) ? [] : [code], 'heat');
    });
  });
  D._heatRows = rowNames; D._heatCodes = rowNames.map(n => D.pca[byName[n]].kode_prov);
  $('cap-heat').innerHTML = caption('skor-z (standar deviasi dari rata-rata 34 provinsi); nilai asli pada tooltip', `2023 (TPT dan TPAK: ${D.periodeNama} 2023)`,
    ['p0', 'gini', 'pub', 'tpt', 'tpak'], ' Urutan: pengelompokan hierarkis (Ward untuk baris, 1−korelasi untuk kolom).');
}
function drawHeatSelection() {
  const n = D.ringkasan ? D.pca.length : 0; if (!D._heatCodes) return;
  const w = VARS.length;
  const shapes = D._heatCodes.map((c, i) => S.sel.has(c) ? { type: 'rect', xref: 'x', yref: 'y', x0: -0.5, x1: w - 0.5, y0: i - 0.5, y1: i + 0.5,
                                                        line: { color: '#000', width: 2.2 }, fillcolor: 'rgba(0,0,0,0)' } : null).filter(Boolean);
  Plotly.relayout('heat', { shapes });
}

/* ---------- 4d. V4 peta ---------- */
const symDiam = v => 2.2 * Math.sqrt(v);          // diameter piksel; luas lingkaran sebanding dengan jumlah penduduk miskin
function drawMap() {
  const k = D.kab;
  const cls = k.map(r => kelasIpm(r.ipm));
  const hover = k.map((r, i) => `<b>${r.nama_kabkota}</b><br>${r.provinsi}<br>IPM 2023: ${fmt(r.ipm)} (${KELAS[cls[i]]})<br>Penduduk miskin: ${fmt(r.jml_miskin)} ribu jiwa`);
  const cs = []; PAL.ipm.forEach((c, i) => cs.push([i / 4, c], [(i + 1) / 4, c]));
  const ch = { type: 'choropleth', geojson: D.geo, featureidkey: 'properties.kode', locations: k.map(r => r.kode_kabkota), z: cls,
               zmin: -0.5, zmax: 3.5, colorscale: cs, text: hover, hovertemplate: '%{text}<extra></extra>',
               marker: { line: { color: '#ffffff', width: 0.25 } },
               colorbar: { title: { text: 'Kelas IPM 2023', side: 'top' }, tickmode: 'array', tickvals: [0, 1, 2, 3], ticktext: ['Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi'],
                           len: 0.5, thickness: 14, x: 0.99, y: 0.5, tickfont: { size: 10 } } };
  const sym = { type: 'scattergeo', lon: k.map(r => r.lon), lat: k.map(r => r.lat), mode: 'markers', text: hover, hovertemplate: '%{text}<extra></extra>',
                marker: { size: k.map(r => symDiam(r.jml_miskin)), sizemode: 'diameter', color: 'rgba(213,94,0,0.55)', line: { color: '#ffffff', width: 0.6 } }, showlegend: false };
  const sel = { type: 'choropleth', geojson: D.geo, featureidkey: 'properties.kode', locations: [], z: [], colorscale: [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']],
                showscale: false, marker: { line: { color: '#000000', width: 1.8 } }, hoverinfo: 'skip', visible: false };
  const layout = { ...baseLayout, dragmode: 'pan', margin: { l: 0, r: 0, t: 0, b: 0 },
                   geo: { projection: { type: 'mercator' }, lonaxis: { range: [94.5, 141.5] }, lataxis: { range: [-11.5, 6.5] }, showland: false, showcoastlines: false,
                          showframe: false, showcountries: false, bgcolor: 'rgba(0,0,0,0)', resolution: 50 } };
  Plotly.newPlot('map', [ch, sym, sel], layout, cfg).then(gd => {
    gd.on('plotly_click', ev => {
      const p = ev.points && ev.points[0]; if (!p) return;
      const r = k[p.pointNumber !== undefined ? p.pointNumber : p.pointIndex]; if (!r) return;
      const code = r.kode_prov_analisis;
      setSelection(S.sel.size === 1 && S.sel.has(code) ? [] : [code], 'map');
    });
  });
  // Layer IPM dimatikan: peta tetap tampil, tetapi satu warna (tanpa kelas IPM)
  $('l-ipm').onchange = e => {
    Plotly.restyle('map', e.target.checked
      ? { z: [cls], colorscale: [cs], showscale: [true] }
      : { z: [cls.map(() => 0)], colorscale: [[[0, PAL.peta1], [1, PAL.peta1]]], showscale: [false] }, [0]);
    drawMapLegend();
  };
  $('l-sym').onchange = e => { Plotly.restyle('map', { visible: [e.target.checked] }, [1]); drawMapLegend(); };
  $('l-sel').onchange = () => drawMapSelection();

  drawMapLegend();
  $('cap-map').innerHTML = caption('IPM: indeks (0–100); penduduk miskin: ribu jiwa', `${TAHUN}`, ['ipm', 'miskin'], CAP_BATAS);
}
function drawMapLegend() {
  const ipmOn = $('l-ipm').checked, symOn = $('l-sym').checked;
  const vmax = Math.max(...D.kab.map(r => r.jml_miskin)), refs = [10, 50, 150, 300].filter(v => v < vmax);
  const warna = ipmOn
    ? KELAS.map((l, i) => `<span><i class="sw" style="background:${PAL.ipm[i]}"></i>${l}</span>`).join('')
    : `<span><i class="sw" style="background:${PAL.peta1}"></i>Kabupaten/kota (satu warna, tanpa kelas IPM)</span>`;
  const lingkaran = refs.map(v => { const d = symDiam(v);
    return `<span class="lg-c"><svg width="${d + 4}" height="${d + 4}" aria-hidden="true"><circle cx="${(d + 4) / 2}" cy="${(d + 4) / 2}" r="${d / 2}" fill="rgba(213,94,0,0.55)" stroke="#D55E00"/></svg><small>${v}</small></span>`; }).join('');
  $('map-legend').innerHTML =
    `<div class="lg-group"><span class="lg-title">${ipmOn ? 'Warna: kelas IPM 2023' : 'Warna wilayah'}</span><div class="lg-items">${warna}<span><i class="sw" style="background:#fff;border:2px solid #000"></i>Provinsi terpilih</span></div></div>` +
    (symOn ? `<div class="lg-group"><span class="lg-title">Lingkaran: jumlah penduduk miskin (ribu jiwa)</span><div class="lg-items lg-circles">${lingkaran}</div>
      <span class="lg-note">Makin besar lingkaran, makin banyak penduduk miskin. Luas lingkaran sebanding dengan jumlahnya.</span></div>` : '') +
''; 
}
function drawMapSelection() {
  if (!D.kab || !document.getElementById('map').data) return;
  const on = $('l-sel').checked && S.sel.size > 0;
  const loc = on ? D.kab.filter(r => S.sel.has(r.kode_prov_analisis)).map(r => r.kode_kabkota) : [];
  Plotly.restyle('map', { locations: [loc], z: [loc.map(() => 0)], visible: [loc.length > 0] }, [2]);
}

/* ---------- 4e. V5 treemap dan sunburst ---------- */
function drawHier() {
  // IPM nasional dari BPS; IPM tiap pulau = rata-rata sederhana IPM provinsi di pulau itu
  const H = D.hier.map(r => ({ ...r }));
  H.forEach(r => {
    if (r.level === 0) r.ipm = IPM_NASIONAL;
    if (r.level === 1) { const ch = H.filter(q => q.level === 2 && q.parent === r.id).map(q => q.ipm); r.ipm = ch.reduce((a, b) => a + b, 0) / ch.length; }
  });
  const color = r => r.ipm !== '' && !isNaN(r.ipm) ? PAL.ipmHier[kelasIpm(r.ipm)] : PAL.netral;
  const ipmNote = ['IPM nasional BPS', 'rata-rata IPM provinsi', '', ''];
  const lvlName = ['Nasional', 'Pulau', 'Provinsi', 'Kabupaten/kota'];
  const common = {
    ids: H.map(r => r.id), labels: H.map(r => r.label), parents: H.map(r => r.parent),
    values: H.map(r => r.level === 3 ? r.jml_miskin : 0), branchvalues: 'remainder',
    marker: { colors: H.map(color), line: { color: '#fff', width: 0.6 } },
    customdata: H.map(r => [lvlName[r.level], fmt(r.jml_miskin), `${fmt(r.ipm)} (${KELAS[kelasIpm(r.ipm)]})${ipmNote[r.level] ? ' – ' + ipmNote[r.level] : ''}`,
                  r.level < 3 ? '<br><i>Klik untuk melihat isinya</i>' : '']),
    hovertemplate: '<b>%{label}</b> (%{customdata[0]})<br>Penduduk miskin: %{customdata[1]} ribu jiwa<br>IPM 2023: %{customdata[2]}%{customdata[3]}<extra></extra>',
    maxdepth: 3,
  };
  const treemap = { type: 'treemap', ...common, textinfo: 'label', pathbar: { visible: true, thickness: 22 }, tiling: { packing: 'squarify' } };
  const sunburst = { type: 'sunburst', ...common, insidetextorientation: 'radial', textinfo: 'label' };
  const lay = { ...baseLayout, margin: { l: 4, r: 4, t: 4, b: 4 } };
  const lab = Object.fromEntries(H.map(r => [r.id, r.label]));
  const crumb = (id, span) => { $(span).textContent = id ? id.split('|').map((_, i, a) => lab[a.slice(0, i + 1).join('|')]).join(' › ') : 'Indonesia'; };
  // Posisi saat ini + tombol panah kembali (naik satu tingkat) + petunjuk klik
  const cur = {};
  const goto = (div, span, id) => {
    cur[div] = id || '';
    crumb(id, span);
    const atRoot = !cur[div] || cur[div] === 'Indonesia';
    $('btn-' + div + '-back').disabled = atRoot;
    $('hint-' + div).textContent = atRoot ? 'Klik sebuah blok untuk melihat isinya, misalnya Jawa.' : 'Klik blok lagi untuk masuk lebih dalam, atau tekan tombol panah untuk kembali.';
  };
  const wire = (div, span) => {
    $('btn-' + div + '-back').onclick = () => {
      const up = cur[div].split('|').slice(0, -1).join('|');
      Plotly.restyle(div, { level: up === 'Indonesia' ? '' : up });
      goto(div, span, up);
    };
  };
  Plotly.newPlot('tree', [treemap], lay, cfg).then(g => g.on('plotly_treemapclick', ev => goto('tree', 'bc-tree', ev.nextLevel)));
  Plotly.newPlot('sun', [sunburst], lay, cfg).then(g => g.on('plotly_sunburstclick', ev => goto('sun', 'bc-sun', ev.nextLevel)));
  wire('tree', 'bc-tree'); wire('sun', 'bc-sun');
  $('hier-legend').innerHTML = `<div class="lg-group"><span class="lg-title">Warna: kelas IPM 2023</span><div class="lg-items">` +
    KELAS.map((l, i) => `<span><i class="sw" style="background:${PAL.ipmHier[i]}"></i>${l}</span>`).join('') + `</div>
    <span class="lg-note">Indonesia memakai IPM nasional BPS (${fmt(IPM_NASIONAL)}); pulau memakai rata-rata IPM provinsinya. Luas blok = penduduk miskin (ribu jiwa).</span></div>`;
  const capH = caption('luas: ribu jiwa (penduduk miskin); warna: indeks IPM', `${TAHUN}`, ['miskin', 'ipm'],
    ` IPM Indonesia: ${link('pub')}. IPM pulau: rata-rata sederhana IPM provinsi (dihitung penulis). Pengelompokan pulau dibuat penulis (bukan data BPS); batas provinsi mengikuti 38 provinsi terbaru.`);
  $('cap-tree').innerHTML = capH; $('cap-sun').innerHTML = capH;
}

/* ---------- 4f. HERO, TEMUAN BAGIAN, PANEL TERPILIH, RENTANG IPM ---------- */
// Strip 514 batang kab/kota diurutkan menurut IPM (warna = kelas IPM, sama dengan peta)
function drawHero() {
  const k = [...D.kab].sort((a, b) => a.ipm - b.ipm);
  const W = 520, H = 250, ml = 30, mr = 8, mt = 22, mb = 34, pw = W - ml - mr, ph = H - mt - mb;
  const Y0 = 30, Y1 = 92, y = v => mt + ph * (1 - (v - Y0) / (Y1 - Y0)), step = pw / k.length;
  const lo = k[0], hi = k[k.length - 1];
  const bars = k.map((r, i) => `<rect class="hb" data-p="${r.kode_prov_analisis}" x="${(ml + i * step).toFixed(2)}" y="${y(r.ipm).toFixed(1)}" width="${(step + 0.3).toFixed(2)}" height="${(y(Y0) - y(r.ipm)).toFixed(1)}" fill="${PAL.ipm[kelasIpm(r.ipm)]}"><title>${r.nama_kabkota}, ${r.provinsi}: IPM ${fmt(r.ipm)}</title></rect>`).join('');
  const profile = k.map((r, i) => `${i ? 'L' : 'M'}${(ml + (i + 0.5) * step).toFixed(1)} ${y(r.ipm).toFixed(1)}`).join('');
  const grid = [40, 60, 70, 80].map(v => `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="#0a2540" stroke-opacity=".35" stroke-dasharray="3 3"/><text x="${ml - 5}" y="${y(v) + 3.5}" text-anchor="end" class="ht">${v}</text>`).join('');
  const halo = 'paint-order="stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round"';
  $('hero-strip').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" focusable="false">
    <line x1="${ml}" x2="${W - mr}" y1="${y(Y0)}" y2="${y(Y0)}" stroke="#9aa5b1"/><text x="${ml - 5}" y="${y(Y0) + 3.5}" text-anchor="end" class="ht">${Y0}</text>
    ${bars}<path d="${profile}" fill="none" stroke="#0a2540" stroke-width="1.3"/>${grid}
    <line x1="${ml}" x2="${W - mr}" y1="${y(IPM_NASIONAL)}" y2="${y(IPM_NASIONAL)}" stroke="#0e7c86" stroke-width="1.5"/>
    <text x="${ml + 6}" y="${y(IPM_NASIONAL) - 6}" class="ht ht-b" fill="#0a636b" ${halo}>Indonesia ${fmt(IPM_NASIONAL)}</text>
    <text x="${ml + 3}" y="${y(lo.ipm) - 6}" class="ht ht-b" ${halo}>${lo.nama_kabkota} ${fmt(lo.ipm, 1)}</text>
    <text x="${W - mr - 3}" y="${y(hi.ipm) - 6}" class="ht ht-b" text-anchor="end" ${halo}>${hi.nama_kabkota} ${fmt(hi.ipm, 1)}</text>
    <text x="${ml}" y="${H - 14}" class="ht">IPM terendah</text>
    <text x="${W - mr}" y="${H - 14}" class="ht" text-anchor="end">IPM tertinggi</text>
    <text x="${ml + pw / 2}" y="${H - 2}" class="ht" text-anchor="middle">satu batang = satu kabupaten/kota; sumbu IPM mulai dari ${Y0}</text></svg>`;
  const cnt = KELAS.map((_, i) => D.kab.filter(r => kelasIpm(r.ipm) === i).length);
  $('hero-legend').innerHTML = KELAS.map((l, i) => `<span><i class="sw" style="background:${PAL.ipm[i]}"></i>${l}: <b>${cnt[i]}</b></span>`).join('');
}
function drawHeroSelection() {
  const svg = document.querySelector('#hero-strip svg'); if (!svg) return;
  const has = S.sel.size > 0;
  svg.querySelectorAll('.hb').forEach(r => { const on = S.sel.has(r.dataset.p); r.classList.toggle('dim', has && !on); r.classList.toggle('sel', has && on); });
}

// Kalimat temuan di bawah judul tiap bagian, dihitung dari data
function drawFindings() {
  const v = D.ringkasan.varians, prof = clusterProfile();
  const poor = prof.reduce((a, b) => (b.mean.p0 > a.mean.p0 ? b : a)), big = prof.reduce((a, b) => (b.n > a.n ? b : a));
  $('find-multivariat').innerHTML = `Dua komponen utama merangkum <b>${fmt((v[0] + v[1]) * 100, 1)}%</b> variasi profil ${D.pca.length} provinsi. ` +
    `Klaster dengan kemiskinan tertinggi (rata-rata P0 <b>${fmt(poor.mean.p0, 1)}%</b>) berisi <b>${poor.n}</b> provinsi` +
    (big.k !== poor.k ? `, sedangkan klaster terbesar berisi <b>${big.n}</b> provinsi.` : '.');

  const minR = D.kab.reduce((a, b) => (a.ipm < b.ipm ? a : b)), maxR = D.kab.reduce((a, b) => (a.ipm > b.ipm ? a : b));
  const lowMid = D.kab.filter(r => kelasIpm(r.ipm) <= 1).length;
  $('find-peta').innerHTML = `Kesenjangan IPM antar kabupaten/kota mencapai <b>${fmt(maxR.ipm - minR.ipm, 1)} poin</b>, dari ${minR.nama_kabkota} (${fmt(minR.ipm, 1)}) sampai ${maxR.nama_kabkota} (${fmt(maxR.ipm, 1)}). ` +
    `Sebanyak <b>${lowMid}</b> dari ${D.kab.length} kab/kota (${fmt(lowMid / D.kab.length * 100, 0)}%) berada di kelas IPM rendah atau sedang.`;

  const tot = D.hier.find(r => r.level === 0).jml_miskin;
  const top5 = D.hier.filter(r => r.level === 2).sort((a, b) => b.jml_miskin - a.jml_miskin).slice(0, 5);
  const pulau = D.hier.filter(r => r.level === 1).sort((a, b) => b.jml_miskin - a.jml_miskin)[0];
  $('find-hierarki').innerHTML = `Pulau ${pulau.label} menanggung <b>${fmt(pulau.jml_miskin / tot * 100, 0)}%</b> dari ${fmt(tot / 1000, 1)} juta penduduk miskin Indonesia, ` +
    `dan lima provinsi dengan jumlah terbanyak menanggung <b>${fmt(top5.reduce((s, r) => s + r.jml_miskin, 0) / tot * 100, 0)}%</b>.`;
}

// Panel ringkasan provinsi terpilih: nilai terpilih vs rata-rata 34 provinsi
let spCollapsed = null;
function drawSelPanel() {
  const el = $('sel-panel'), has = S.sel.size > 0;
  el.hidden = !has; if (!has) return;
  if (spCollapsed === null) spCollapsed = window.matchMedia('(max-width:600px)').matches;
  const idx = D.pca.map((r, i) => (S.sel.has(r.kode_prov) ? i : -1)).filter(i => i >= 0), n = idx.length;
  const avg = (f) => idx.reduce((s, i) => s + f(i), 0) / n, all = D.pca.length;
  const one = n === 1 ? D.pca[idx[0]] : null;
  $('sp-title').innerHTML = one
    ? `${one.provinsi} <small><span class="dot" style="background:${PAL.klaster[one.klaster - 1]}"></span>Klaster ${one.klaster}</small>`
    : `${n} provinsi terpilih <small>rata-rata</small>`;
  const rows = VARS.map(x => {
    const val = avg(i => D.pca[i][x.k]), nas = D.pca.reduce((s, r) => s + r[x.k], 0) / all, z = avg(i => D.z[i][x.k]);
    const w = Math.min(Math.abs(z) / 3, 1) * 50, c = z < 0 ? PAL.div[0][1] : PAL.div[2][1];
    return `<div class="sp-row"><span class="sp-k">${x.short}<small>${x.unit}</small></span><b class="sp-v">${fmt(val, x.d)}</b>` +
      `<span class="sp-z" title="Skor-z ${fmt(z, 1)}"><i style="${z < 0 ? 'right' : 'left'}:50%;width:${w}%;background:${c}"></i></span><span class="sp-n">${fmt(nas, x.d)}</span></div>`;
  }).join('');
  const kb = D.kab.filter(r => S.sel.has(r.kode_prov_analisis));
  const kTot = kb.reduce((s, r) => s + r.jml_miskin, 0), allTot = D.kab.reduce((s, r) => s + r.jml_miskin, 0);
  const iLo = Math.min(...kb.map(r => r.ipm)), iHi = Math.max(...kb.map(r => r.ipm));
  $('sp-body').innerHTML = `<div class="sp-row sp-hd"><span></span><span>Terpilih</span><span class="sp-zh"><span>di bawah</span><span>di atas</span></span><span class="sp-n">Rata-rata ${all} prov.</span></div>${rows}
    <p class="sp-note">${kb.length} kab/kota, IPM ${fmt(iLo, 1)}–${fmt(iHi, 1)}. Penduduk miskin ${fmt(kTot / 1000, 2)} juta jiwa (${fmt(kTot / allTot * 100, 1)}% dari total).</p>`;
  el.classList.toggle('collapsed', spCollapsed);
  $('sp-toggle').setAttribute('aria-expanded', String(!spCollapsed));
}

// Rentang IPM kab/kota di dalam tiap provinsi (34 provinsi batas lama, agar terhubung dengan tampilan lain)
function drawRange() {
  const byP = {}, nama = Object.fromEntries(D.pca.map(r => [r.kode_prov, r.provinsi]));
  D.kab.forEach(r => (byP[r.kode_prov_analisis] = byP[r.kode_prov_analisis] || []).push(r));
  const rows = Object.entries(byP).map(([code, a]) => {
    const s = [...a].sort((p, q) => p.ipm - q.ipm), m = s.length;
    return { code, name: nama[code] || code, n: m, lo: s[0], hi: s[m - 1], med: m % 2 ? s[(m - 1) / 2].ipm : (s[m / 2 - 1].ipm + s[m / 2].ipm) / 2, sel: s[m - 1].ipm - s[0].ipm };
  }).sort((a, b) => b.sel - a.sel);
  D._rangeRows = rows;
  const cd = rows.map(r => [r.code, r.name, r.lo.nama_kabkota, r.lo.ipm, r.hi.nama_kabkota, r.hi.ipm, r.med, r.n, r.sel]);
  const ht = '<b>%{customdata[1]}</b> (%{customdata[7]} kab/kota)<br>Terendah: %{customdata[2]} (%{customdata[3]:.1f})<br>Tertinggi: %{customdata[4]} (%{customdata[5]:.1f})<br>Selisih: %{customdata[8]:.1f} poin<br>Median: %{customdata[6]:.1f}<extra></extra>';
  const names = rows.map(r => r.name);
  const bar = { type: 'bar', orientation: 'h', y: names, x: rows.map(r => r.sel), base: rows.map(r => r.lo.ipm), width: 0.55,
                marker: { color: '#8da2b8', opacity: rows.map(() => 1) }, customdata: cd, hovertemplate: ht, showlegend: false };
  const med = { type: 'scatter', mode: 'markers', y: names, x: rows.map(r => r.med), customdata: cd, hovertemplate: ht, showlegend: false,
                marker: { symbol: 'diamond', size: 9, color: '#0a2540', line: { color: '#fff', width: 1 }, opacity: rows.map(() => 1) } };
  const xmin = Math.floor(Math.min(...rows.map(r => r.lo.ipm)) / 5) * 5 - 2, xmax = Math.ceil(Math.max(...rows.map(r => r.hi.ipm)) / 5) * 5 + 2;
  const vline = (x, color, dash) => ({ type: 'line', xref: 'x', yref: 'paper', x0: x, x1: x, y0: 0, y1: 1, line: { color, width: dash ? 1.5 : 1, dash: dash || 'dot' } });
  const lab = (x, t, c = '#4a5866') => ({ x, y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', yshift: 4, showarrow: false, text: t, font: { size: 10.5, color: c } });
  const layout = { ...baseLayout, margin: { l: 10, r: 16, t: 58, b: 50 }, hovermode: 'closest', bargap: 0.3,
    xaxis: { range: [xmin, xmax], title: { text: 'IPM kabupaten/kota 2023' }, gridcolor: '#eceff2', fixedrange: true, zeroline: false },
    yaxis: { autorange: 'reversed', automargin: true, tickfont: { size: 11 }, fixedrange: true, showgrid: false },
    shapes: [60, 70, 80].map(x => vline(x, '#aeb7c0')).concat([vline(IPM_NASIONAL, '#0e7c86', 'dash')]),
    annotations: [lab((xmin + 60) / 2, 'Rendah'), lab(65, 'Sedang'), lab(75, 'Tinggi'), lab((80 + xmax) / 2, 'Sangat tinggi'),
                  { ...lab(IPM_NASIONAL, `Indonesia ${fmt(IPM_NASIONAL)}`, '#0a636b'), yshift: 22 }] };
  Plotly.newPlot('range', [bar, med], layout, { ...cfg, scrollZoom: false, displayModeBar: false }).then(gd => {
    gd.on('plotly_click', ev => {
      const code = ev.points && ev.points[0] && ev.points[0].customdata && ev.points[0].customdata[0]; if (!code) return;
      setSelection(S.sel.size === 1 && S.sel.has(code) ? [] : [code], 'range');
    });
  });
  $('cap-range').innerHTML = caption('IPM: indeks (0–100)', `${TAHUN}`, ['ipm'],
    ' Provinsi memakai 34 provinsi batas lama agar terhubung dengan tampilan lain; urutan menurut selisih terbesar. Garis putus-putus hijau-biru = IPM Indonesia (BPS). Selisih ini menunjukkan kesenjangan antarwilayah, bukan ketimpangan antarpenduduk (lihat Gini ratio).');
}
function drawRangeSelection() {
  const gd = document.getElementById('range'); if (!gd || !gd.data || !D._rangeRows) return;
  const has = S.sel.size > 0, op = D._rangeRows.map(r => (!has || S.sel.has(r.code) ? 1 : 0.22));
  Plotly.restyle('range', { 'marker.opacity': [op] }, [0, 1].map(i => i)).catch(() => {});
}

/* ---------- 5. TEMUAN, METODOLOGI, SUMBER ---------- */
function drawKPI() {
  const ipm = D.kab.map(r => r.ipm), tot = D.kab.reduce((s, r) => s + r.jml_miskin, 0);
  const minR = D.kab.reduce((a, b) => a.ipm < b.ipm ? a : b), maxR = D.kab.reduce((a, b) => a.ipm > b.ipm ? a : b);
  $('kpi').innerHTML = [
    [D.pca.length, 'provinsi dianalisis (batas lama)'],
    [D.kab.length, 'kabupaten/kota dipetakan'],
    [`${fmt(minR.ipm, 1)}–${fmt(maxR.ipm, 1)}`, `rentang IPM kab/kota (${minR.nama_kabkota} – ${maxR.nama_kabkota})`],
    [fmt(tot / 1000, 1) + ' juta', 'jumlah penduduk miskin (jumlah 514 kab/kota)'],
  ].map(([b, s]) => `<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join('');
}

function drawInsights() {
  const R = D.ringkasan, v = R.varians, prof = clusterProfile();
  const loadAbs = D.loadings.map(l => ({ k: l.variabel, p1: l.pc1, p2: l.pc2 })).sort((a, b) => Math.abs(b.p1) - Math.abs(a.p1));
  const nm = k => VARS.find(x => x.k === k).short;
  const li = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;

  // pencilan: jarak ke pusat pada bidang PC1-PC2
  const dist = D.pca.map((r, i) => ({ r, d: Math.hypot(r.pc1, r.pc2), i })).sort((a, b) => b.d - a.d).slice(0, 5).map(o => {
    const z = VARS.map(x => [x, D.z[o.i][x.k]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    return `<b>${o.r.provinsi}</b>: paling menonjol pada ${z[0].short} (skor-z ${fmt(z[1], 1)}).`;
  });

  // ketimpangan di dalam provinsi (kab/kota, batas baru)
  const byP = {}; D.kab.forEach(r => (byP[r.provinsi] = byP[r.provinsi] || []).push(r));
  const rng = Object.entries(byP).filter(([, a]) => a.length >= 4).map(([p, a]) => {
    const lo = a.reduce((x, y) => x.ipm < y.ipm ? x : y), hi = a.reduce((x, y) => x.ipm > y.ipm ? x : y);
    return { p, sel: hi.ipm - lo.ipm, lo, hi };
  }).sort((a, b) => b.sel - a.sel).slice(0, 4).map(o =>
    `<b>${o.p}</b>: selisih ${fmt(o.sel, 1)} poin, dari ${o.lo.nama_kabkota} (${fmt(o.lo.ipm, 1)}) sampai ${o.hi.nama_kabkota} (${fmt(o.hi.ipm, 1)}).`);

  // beban penduduk miskin menurut provinsi dan pulau
  const tot = D.hier.find(r => r.level === 0).jml_miskin;
  const provs = D.hier.filter(r => r.level === 2).sort((a, b) => b.jml_miskin - a.jml_miskin);
  const top5 = provs.slice(0, 5), share5 = top5.reduce((s, r) => s + r.jml_miskin, 0) / tot * 100;
  const pulau = D.hier.filter(r => r.level === 1).sort((a, b) => b.jml_miskin - a.jml_miskin)[0];

  $('insights').innerHTML = `
  <div class="insight-card"><span class="tag">Deskriptif</span><h3>Struktur utama indikator</h3>
    <p>Dua komponen pertama menjelaskan ${fmt((v[0] + v[1]) * 100, 1)}% varians (PC1 ${fmt(v[0] * 100, 1)}%, PC2 ${fmt(v[1] * 100, 1)}%).
    Indikator dengan muatan terbesar pada PC1: ${loadAbs.slice(0, 3).map(l => `${nm(l.k)} (${fmt(l.p1, 2)})`).join(', ')}.</p></div>

  <div class="insight-card"><span class="tag">Deskriptif</span><h3>Pencilan pada bidang PC1–PC2</h3>${li(dist)}</div>

  <div class="insight-card wide"><span class="tag">Deskriptif</span><h3>Profil klaster (rata-rata nilai asli)</h3>
    <div class="table-wrap"><table><thead><tr><th>Klaster</th><th class="num">n</th>${VARS.map(x => `<th class="num">${x.short}<br><small>${x.unit}</small></th>`).join('')}<th>Anggota</th></tr></thead><tbody>
    ${prof.map(c => `<tr><td><span style="color:${PAL.klaster[c.k - 1]}">●</span> ${c.k}</td><td class="num">${c.n}</td>${VARS.map(x => `<td class="num">${fmt(c.mean[x.k], x.d)}</td>`).join('')}<td>${c.provs.join(', ')}</td></tr>`).join('')}
    </tbody></table></div></div>

  <div class="insight-card"><span class="tag">Deskriptif</span><h3>Kesenjangan IPM antarwilayah di dalam provinsi</h3>
    <p>Selisih IPM tertinggi dan terendah antar kab/kota dalam satu provinsi paling besar di (ini kesenjangan antarwilayah, bukan ketimpangan antarpenduduk):</p>${li(rng)}</div>

  <div class="insight-card"><span class="tag">Deskriptif</span><h3>Konsentrasi penduduk miskin</h3>
    <p>Lima provinsi dengan penduduk miskin terbanyak (${top5.map(r => r.label).join(', ')}) menyumbang ${fmt(share5, 1)}% dari total ${fmt(tot / 1000, 1)} juta jiwa.
    Pulau dengan jumlah terbesar: ${pulau.label} (${fmt(pulau.jml_miskin / tot * 100, 1)}%).</p></div>

  <div class="insight-card wide"><span class="tag">Keterbatasan</span><h3>Hal yang perlu diingat saat membaca</h3>${li([
    `Struktur klaster lemah: nilai silhouette k=${R.k} hanya ${fmt(R.silhouette_per_k[R.k], 3)} (k=2: ${fmt(R.silhouette_per_k[2], 3)}), sehingga klaster adalah ringkasan kemiripan, bukan kelompok yang tegas. Provinsi di perbatasan klaster mudah berpindah.`,
    `Pemilihan periode Sakernas berpengaruh: dengan Februari, 10 dari 34 provinsi berpindah klaster (ARI ${fmt(R.ari_feb_vs_agu, 2)}), meski korelasi TPT dan TPAK antar-periode tinggi (${fmt(R.korelasi_tpt_feb_agu, 2)} dan ${fmt(R.korelasi_tpak_feb_agu, 2)}).`,
    'Hanya 34 provinsi (batas lama) yang punya data lengkap pada tabel provinsi; kab/kota Papua hasil pemekaran dipetakan ke provinsi lama agar dapat dihubungkan dengan PCA.',
    'IPM hanya salah satu pendekatan kesejahteraan (kesehatan, pendidikan, standar hidup) dan berupa rata-rata, sehingga tidak menunjukkan ketimpangan antarpenduduk. Karena itu profil provinsi dibaca dari delapan indikator (P0, Gini, UHH, HLS, RLS, pengeluaran, TPT, TPAK), dan ketimpangan antarpenduduk diwakili Gini ratio.',
    'Semua temuan bersifat deskriptif. Hubungan antarindikator tidak dapat ditafsirkan sebagai sebab-akibat.'])}</div>`;
}

function drawMethod() {
  const R = D.ringkasan;
  $('method').innerHTML = `
  <h4>Data dan penggabungan</h4>
  <p>Data utama berasal dari BPS (tahun ${TAHUN}). Tabel provinsi (34 provinsi) dan kab/kota (514) dicocokkan lewat nama wilayah ke berkas batas wilayah (yang membawa kode wilayah, bukan dari tabel BPS); batas wilayah kab/kota dipakai sebagai data pendukung non-BPS. Pembersihan (angka berformat Indonesia, penggandaan baris Papua, kode ganda pada peta) dicatat di <a href="data/processed/data_issues.md">data_issues.md</a>.</p>
  <h4>Multivariat</h4>
  <p>Delapan indikator numerik (${VARS.map(x => x.short).join(', ')}) distandardisasi (skor-z), lalu dianalisis dengan PCA (dekomposisi nilai singular). IPM tidak dimasukkan karena dihitung dari UHH, HLS, RLS, dan pengeluaran sehingga akan menghitung komponen yang sama dua kali. Klaster memakai k-means (k=${R.k}, dipilih dari silhouette tertinggi di antara k≥3, seed ${R.seed}). Heatmap diurutkan dengan pengelompokan hierarkis.</p>
  <h4>Geospasial</h4>
  <p>Choropleth memakai indeks IPM sebagai salah satu pendekatan kesejahteraan (bukan ukuran kesejahteraan seutuhnya, dan bukan angka absolut) dengan kelas ambang BPS agar tiap kelas bermakna dan dapat dibandingkan dengan publikasi BPS. Angka absolut (penduduk miskin) dikodekan dengan luas lingkaran. Palet biru–teal berurutan (terang = IPM rendah, gelap = tinggi) dipakai karena urut secara persepsi dan aman bagi buta warna.</p>
  <h4>Hierarki</h4>
  <p>Indonesia → pulau → provinsi → kab/kota. Luas = penduduk miskin, warna = kelas IPM (empat warna berbeda agar mudah dibedakan). IPM Indonesia memakai angka nasional BPS (${fmt(IPM_NASIONAL)}); IPM pulau adalah rata-rata sederhana IPM provinsi di pulau itu. Pengelompokan pulau dibuat penulis.</p>
  <h4>Pilihan encoding</h4>
  <p>Posisi dipakai untuk kedekatan profil (PCA) karena paling akurat dibaca; warna kategorial (violet, merah muda, mustard; dipilih agar berbeda dari palet IPM dan lolos uji buta warna) untuk klaster; bentuk untuk pulau (kategori kedua); palet divergen biru–jingga pada heatmap karena nilai berpusat di rata-rata; luas untuk besaran absolut.</p>
  <h4>Perangkat</h4>
  <p>Python (pandas, NumPy, SciPy, scikit-learn, Shapely) untuk pengolahan; HTML statis dan Plotly.js (disertakan di repositori) untuk visualisasi. Tidak memerlukan login atau instalasi.</p>`;
}

function drawSources() {
  const rows = [
    ['IPM kab/kota', 'kab/kota', '2023', 'indeks', 'ipm'],
    ['Penduduk miskin kab/kota', 'kab/kota', '2023', 'ribu jiwa', 'miskin'],
    ['P0 (persentase penduduk miskin)', 'provinsi', 'Maret 2023', '%', 'p0'],
    ['Gini ratio', 'provinsi', 'Maret 2023', 'rasio 0–1', 'gini'],
    ['UHH, HLS, RLS, pengeluaran per kapita riil disesuaikan', 'provinsi', '2023', 'tahun; ribu Rp/orang/tahun', 'pub'],
    ['TPT', 'provinsi', `Februari dan Agustus 2023 (dipakai: ${D.periodeNama})`, '%', 'tpt'],
    ['TPAK', 'provinsi', `Februari dan Agustus 2023 (dipakai: ${D.periodeNama})`, '%', 'tpak'],
  ];
  $('src-table').innerHTML = `<thead><tr><th>Data</th><th>Tingkat</th><th>Periode</th><th>Satuan</th><th>Tabel/publikasi BPS</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${link(r[4])}${r[4] === 'pub' ? ' (Lampiran 2; UHH, HLS, RLS hlm. 138)' : ''}</td></tr>`).join('') +
    `<tr><td>Batas wilayah kab/kota</td><td>kab/kota</td><td>–</td><td>poligon</td><td>Lapak GIS (non-BPS, data pendukung)</td></tr></tbody>`;
}

/* ---------- 6. INISIALISASI ---------- */
async function init() {
  try {
    const [pca, z, load, heat, kab, hier, geo, ring] = await Promise.all([
      getCSV('pca_provinsi_2023.csv'), getCSV('zscore_provinsi_2023.csv'), getCSV('pca_loadings_2023.csv'),
      getJSON('heatmap_order_2023.json'), getCSV('kabkota_app_2023.csv'), getCSV('hierarki_2023.csv'),
      getJSON('kabkota.geojson'), getJSON('ringkasan_2023.json')]);
    const per = ring.periode_kerja === 'agu' ? 'Agustus' : 'Februari';
    D.periodeNama = per;
    VARS = [
      { k: 'p0', short: 'P0', unit: '%', d: 2 }, { k: 'gini', short: 'Gini', unit: 'rasio', d: 3 },
      { k: 'uhh', short: 'UHH', unit: 'tahun', d: 2 }, { k: 'hls', short: 'HLS', unit: 'tahun', d: 2 }, { k: 'rls', short: 'RLS', unit: 'tahun', d: 2 },
      { k: 'pengeluaran', short: 'Pengeluaran', unit: 'ribu Rp/orang/tahun', d: 0 },
      { k: 'tpt', short: `TPT ${per.slice(0, 3)}`, unit: '%', d: 2 }, { k: 'tpak', short: `TPAK ${per.slice(0, 3)}`, unit: '%', d: 2 },
    ];
    Object.assign(D, { pca, z, loadings: load, heatOrder: heat, kab, hier, geo, ringkasan: ring });
    S.K = ring.k;
    // saring baris z agar urutan sama dengan pca
    D.z = pca.map(r => z.find(q => q.provinsi === r.provinsi));
    D.kab.forEach(r => { r.kota = String(r.kota) === 'True'; });

    // filter global
    $('f-pulau').innerHTML = '<option value="">Semua</option>' + [...new Set(pca.map(r => r.pulau))].map(p => `<option>${p}</option>`).join('');
    $('f-klaster').innerHTML = '<option value="">Semua</option>' + Array.from({ length: S.K }, (_, i) => `<option value="${i + 1}">Klaster ${i + 1}</option>`).join('');
    $('f-pulau').onchange = e => e.target.value ? selectPulau(e.target.value) : setSelection([], 'filter');
    $('f-klaster').onchange = e => e.target.value ? selectCluster(+e.target.value) : setSelection([], 'filter');
    $('btn-reset').onclick = () => { $('f-pulau').value = ''; $('f-klaster').value = ''; setSelection([], 'reset'); };
    $('t-arrows').onchange = e => Plotly.relayout('pca', { annotations: e.target.checked ? D._pcaAnn : [] });

    drawKPI(); drawHero(); drawPCA(); drawHeat(); drawPar(); drawMap(); drawRange(); drawHier(); drawFindings(); drawInsights(); drawMethod(); drawSources();
    $('sp-toggle').onclick = () => { spCollapsed = !spCollapsed; drawSelPanel(); };
    $('sp-close').onclick = () => $('btn-reset').click();
  } catch (err) {
    console.error(err);
    const b = $('banner'); b.hidden = false;
    b.innerHTML = `<b>Data tidak dapat dimuat.</b> ${err.message}. Jika halaman dibuka langsung dari berkas (file://), jalankan server lokal: <code>python -m http.server</code> lalu buka <code>http://localhost:8000</code>. Di GitHub Pages hal ini tidak diperlukan.`;
  }
}
init();
})();