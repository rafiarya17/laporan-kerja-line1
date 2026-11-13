# Portal terpadu — pratinjau 0.4

Dasar: commit b83f888 (monitor live Champer), branch feat/portal-preview-20261113.
Pintu masuk: `/portal-preview.html`.

## Yang dapat diuji

- Ringkasan dan Monitor Live general: filter tanggal, shift, line, mesin, pencarian, jenis integrasi; klik kartu line atau detail mesin.
- Katalog dari snapshot master 29 Oktober 2026. Champer ditambahkan sebagai pilot Line 99; entri asli Line 1 tetap manual. Belum merupakan sinkronisasi master terbaru.
- Detail pilot dengan contoh perubahan counter, MTC, dandori dan kehilangan pembaruan. Counter terakhir saat putus diberi label histori; bukan nol.
- Satu navigasi portal dengan halaman existing tertanam, mempertahankan state halaman saat berpindah menu. Target leader dan laporan contoh dapat dibaca; tindakan produksi ditolak.
- Pekerjaan operator → target contoh → sesi Start/End simulasi → input hasil → riwayat browser. Mesin lain menuju form lama; belum otomatis mengisi pilihan form.
- Form LKH dibuka sebagai halaman terpisah melalui tautan di bagian atas, bukan menu sidebar atau iframe. Master preview memakai nama operator contoh; pengiriman tidak diaktifkan.
- Monitor Live menampilkan aktual bruto dan target OK per shift atau sesi berjalan. Persentase bruto/target bersifat indikatif; hasil OK yang dilaporkan ditampilkan terpisah. Pergantian sesi mengubah titik awal perhitungan, tidak mereset counter kumulatif PLC.
- Mode TV landscape memuat maksimal enam mesin per layar, dengan pergantian halaman otomatis setiap 15 detik dan tombol layar penuh. Diuji pada 1920×1080 dan 1366×768.
- Contoh pergantian shift/sesi, kenaikan hitungan dan putus data tersedia. Data yang tidak tersedia ditampilkan sebagai tanda pisah; histori diberi label.
- Performa mesin terhubung dua arah ke Monitor Live, mempertahankan tanggal/shift/mesin. Klik nama mesin pada kartu Live untuk membuka analisis; pilih Buka di Monitor Live untuk kembali.
- OEE, Availability, Performance, Quality, efisiensi waktu (A × P), pencapaian target OK, kehilangan waktu, komposisi kualitas, tren periode pilihan, tabel mesin, serta ringkasan line dan Welding. Rentang tanggal inklusif, Shift 1/2 atau Semua shift. Ringkasan selalu menunjukkan cakupan data; mesin tanpa data tidak dianggap nol.

## Definisi performa pratinjau

Seluruh data performa adalah simulasi. Counter bruto dan target menggunakan state periode Monitor Live yang sama; waktu, CT ideal dan klasifikasi kualitas merupakan contoh tambahan. Nama mesin tetap dari snapshot katalog, dan hanya AUTO CHAMPER Line 99 memiliki metrik contoh. Entri lainnya tetap kosong/belum terintegrasi.

Fixture dasar Shift 1: rencana 480 menit, berjalan 400 menit, CT ideal 120 detik/pcs, bruto 120, OK pertama kali 80, repair 25, reject 15, target OK 200. Hasil: A 83,333%, P 60%, Q 66,667%, OEE 33,333%, efisiensi waktu 50%, pencapaian target 40%. Waktu: berhenti 80 + kehilangan kecepatan 160 + kehilangan kualitas 80 + produktif ideal 160 = 480 menit. Fixture Shift 2 menunjukkan nol produksi dan nol waktu berjalan dalam periode rencana 480 menit: OEE 0, Q/P tidak terdefinisi; ini contoh periode lengkap, bukan perkiraan shift yang belum dimulai.

Setiap tanggal/shift dalam rentang menggunakan fixture yang sama, dengan perubahan contoh Monitor Live tersimpan per periode selama halaman terbuka. Tren harian untuk maksimal 31 hari, bulanan untuk rentang lebih panjang (termasuk bulan parsial). Klik batang menampilkan komponen periode. Angka ini bukan histori produksi tersimpan.

Agregat menjumlahkan waktu dan kuantitas, bukan rata-rata persentase. OEE = Σ(OK × CT ideal part) / Σwaktu terencana; Quality = ΣOK / Σbruto. Saat CT berbeda, Q berbasis pcs tidak langsung dikalikan A×P untuk OEE agregat. Target dihitung sekali per mesin–tanggal–shift. Semua shift meliputi Shift 1 dan 2. Welding mencakup Line 99 Uji, tetapi hanya satu dari 44 mesin memiliki contoh data sehingga hasil berlabel parsial. Periode dengan input tidak sah mengosongkan metrik terkait.

Acuan formula: https://www.oee.com/calculating-oee/ (Vorne, diperiksa 13 November 2026). Quality = good first-pass / total; performance = ideal time / run time; availability = run / planned. CT detik dikonversi ke menit. Efisiensi waktu A×P adalah definisi usulan yang ditulis eksplisit, bukan efisiensi tenaga kerja. Tidak menetapkan ambang perusahaan atau benchmark 85%.

Data yang belum terverifikasi mengosongkan metrik terkait, bukan nol. Kenaikan bruto contoh tanpa kualitas baru menyebabkan Q/OEE belum tersedia. Performance di atas 100% ditandai perlu pemeriksaan, tidak dipotong menjadi 100%. Sinyal MTC/dandori tidak digunakan otomatis sebagai downtime; interval berhenti perlu verifikasi, tidak tumpang tindih. Untuk multi-part, waktu ideal perlu dihitung per part; untuk target bersama, jangan menggandakan target per sesi.

Sebelum KPI nyata: sepakati waktu rencana/istirahat/lembur, bukti run/stop, CT ideal vs CT standar dan pcs per pulse, klasifikasi repair, kebijakan counter reset/rollover, serta penyimpanan histori. Penggabungan navigasi ke produksi menunggu peninjauan pengguna; jangan mempromosikan preview beserta fixture ke domain utama.

## Batas isolasi

`portalPreview()` aktif untuk Vercel Preview atau `ANDON_PORTAL_PREVIEW=1` lokal, dan selalu false di Vercel Production. Semua API menuju receiver, cloud queue, Redis, pairing, laporan, atau telemetry dipotong sebelum memanggil layanan luar. Preview leader hanya mengizinkan snapshot contoh. Nama operator asli tidak disajikan oleh API master preview.

Tidak ada akses VB, Takebishi, jaringan PLC, jurnal collector, database produksi, atau perubahan master. Tidak ada perubahan ID laporan, perhitungan sesi, pencegahan duplikasi, atau proses TF Slip produksi. `leader.js` memakai helper pembatalan permintaan yang sudah ada agar tablet tanpa AbortSignal.any dapat membuka halaman; timeout tetap 80 detik.

Angka dashboard contoh bukan hasil sesi simulasi browser: keduanya sengaja diberi konteks berbeda. Belum ada agregasi sesi lintas perangkat atau histori status mesin. Integrasi angka aktual ke portal merupakan tahap setelah peninjauan UI; monitor produksi lama tetap berjalan terpisah tanpa perubahan.

## Uji lokal

PowerShell di repo: set `$env:ANDON_PORTAL_PREVIEW='1'`, lalu `node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 4357`.
Browser checks: `scripts/portal-preview-browser.cjs` dan `scripts/portal-monitor-browser.cjs`; gunakan `PLAYWRIGHT_MODULE` bila runtime tersedia terpisah. Test menggunakan API preview lokal; tidak mengoperasikan PLC atau mengirim laporan nyata. Perhitungan contoh diuji di `tests/portal-monitor.cjs`.

## Panduan pengguna bertahap

1. Buka tautan preview pada `/portal-preview.html`. Pastikan label Pratinjau / tanpa koneksi PLC terlihat.
2. Klik Line 99 pada ringkasan. Harus tersisa satu kartu AUTO CHAMPER.
3. Detail mesin → +12 hitungan contoh. Angka berubah tanpa membaca PLC. Coba putus data lalu pulihkan contoh.
4. Pilih Line 1 → AUTO CHAMPER. Tetap Belum terintegrasi; alur form lama.
5. Target leader → Hasil & pemeriksaan → Pekerjaan operator: semua di portal yang sama.
6. Dari pekerjaan, pilih Line 99 dan target contoh. Siapkan, Mulai, Tambah 12, Akhiri, isi kualitas, simpan simulasi. Riwayat tetap terlihat setelah berganti menu / refresh.
7. Buka form LKH melalui tautan atas: berpindah ke halaman form tersendiri; pengiriman nyata belum tersedia di preview.
8. Monitor Live → pilih per shift/sesi berjalan → Mode TV. Gunakan filter line/mesin, tombol halaman atau rotasi otomatis.
9. Performa mesin → tanggal awal 1 November 2026, akhir 3 November 2026 → Semua shift. Dengan contoh bersih: enam catatan, OEE 16,7%, A 41,7%, P 60%, Q 66,7%. Klik Line 99 pada tabel ringkasan; rentang dan shift tetap. Pilih mesin untuk detail atau Semua line/mesin untuk Welding.
10. Samakan tanggal awal dan akhir untuk satu hari. Rentang terbalik menampilkan pesan tanpa hasil lama. Pilih rentang lebih dari 31 hari untuk tren bulanan. Tombol Monitor Live membuka tanggal awal dan Shift 1 jika analisis Semua shift.

Verifikasi tambahan: `tests/portal-performance.cjs` menguji rumus, rekonsiliasi kehilangan, nol denominator, missing input, dan performance mustahil. `scripts/portal-performance-browser.cjs` menguji filter/navigasi dua arah, dampak kenaikan counter, stale, tren dan tata letak desktop/TV/tablet/ponsel.

Referensi Looker Studio halaman 5 belum dapat diakses pada sesi pengerjaan; desain ini tidak mengklaim menyalin visual halaman tersebut.

Belum diterbitkan ke domain produksi. Preview perlu tautan berbagi Vercel jika perlindungan autentikasi aktif.
