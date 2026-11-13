# Portal terpadu — pratinjau 0.1

Dasar: commit b83f888 (monitor live Champer), branch feat/portal-preview-20261113.
Pintu masuk: `/portal-preview.html`.

## Yang dapat diuji

- Ringkasan dan Monitor Live general: filter tanggal, shift, line, mesin, pencarian, jenis integrasi; klik kartu line atau detail mesin.
- Katalog dari snapshot master 29 Oktober 2026. Champer ditambahkan sebagai pilot Line 99; entri asli Line 1 tetap manual. Belum merupakan sinkronisasi master terbaru.
- Detail pilot dengan contoh perubahan counter, MTC, dandori dan kehilangan pembaruan. Counter terakhir saat putus diberi label histori; bukan nol.
- Satu navigasi portal dengan halaman existing tertanam, mempertahankan state halaman saat berpindah menu. Target leader dan laporan contoh dapat dibaca; tindakan produksi ditolak.
- Pekerjaan operator → target contoh → sesi Start/End simulasi → input hasil → riwayat browser. Mesin lain menuju form lama; belum otomatis mengisi pilihan form.
- Form lama mempertahankan UI. Master preview memakai nama operator contoh; pengiriman tidak diaktifkan.

## Batas isolasi

`portalPreview()` aktif untuk Vercel Preview atau `ANDON_PORTAL_PREVIEW=1` lokal, dan selalu false di Vercel Production. Semua API menuju receiver, cloud queue, Redis, pairing, laporan, atau telemetry dipotong sebelum memanggil layanan luar. Preview leader hanya mengizinkan snapshot contoh. Nama operator asli tidak disajikan oleh API master preview.

Tidak ada akses VB, Takebishi, jaringan PLC, jurnal collector, database produksi, atau perubahan master. Tidak ada perubahan ID laporan, perhitungan sesi, pencegahan duplikasi, atau proses TF Slip produksi. `leader.js` memakai helper pembatalan permintaan yang sudah ada agar tablet tanpa AbortSignal.any dapat membuka halaman; timeout tetap 80 detik.

Angka dashboard contoh bukan hasil sesi simulasi browser: keduanya sengaja diberi konteks berbeda. Belum ada agregasi sesi lintas perangkat atau histori status mesin. Integrasi angka aktual ke portal merupakan tahap setelah peninjauan UI; monitor produksi lama tetap berjalan terpisah tanpa perubahan.

## Uji lokal

PowerShell di repo: set `$env:ANDON_PORTAL_PREVIEW='1'`, lalu `node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 4357`.
Browser checks: `scripts/portal-preview-browser.cjs`; gunakan `PLAYWRIGHT_MODULE` bila runtime tersedia terpisah. Test menggunakan API preview lokal; tidak mengoperasikan PLC atau mengirim laporan nyata.

## Panduan pengguna bertahap

1. Buka tautan preview pada `/portal-preview.html`. Pastikan label Pratinjau / tanpa koneksi PLC terlihat.
2. Klik Line 99 pada ringkasan. Harus tersisa satu kartu AUTO CHAMPER.
3. Detail mesin → +12 hitungan contoh. Angka berubah tanpa membaca PLC. Coba putus data lalu pulihkan contoh.
4. Pilih Line 1 → AUTO CHAMPER. Tetap Belum terintegrasi; alur form lama.
5. Target leader → Hasil & pemeriksaan → Pekerjaan operator: semua di portal yang sama.
6. Dari pekerjaan, pilih Line 99 dan target contoh. Siapkan, Mulai, Tambah 12, Akhiri, isi kualitas, simpan simulasi. Riwayat tetap terlihat setelah berganti menu / refresh.
7. Form produksi dapat ditinjau; pengiriman nyata belum tersedia di preview.

Belum diterbitkan ke domain produksi. Preview perlu tautan berbagi Vercel jika perlindungan autentikasi aktif.
