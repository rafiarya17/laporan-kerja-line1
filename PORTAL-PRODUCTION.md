# Portal terpadu — 13 November 2026

Pintu masuk `/portal.html`. URL lama `/`, `/leader`, `/pekerjaan.html`, `/champer-plc.html`, dan `/monitor-live.html` tetap berfungsi. Form LKH tetap halaman tersendiri; tidak dipindah ke iframe atau diubah kontrak penyimpanannya.

## Batas perubahan

- Menu menampung halaman existing dalam iframe same-origin; cookie tablet, local/session storage, ID permintaan dan ID laporan tetap dipakai. Satu iframe leader dibagi oleh target dan pemeriksaan. Berpindah menu tidak memuat ulang frame sehingga draft tetap ada.
- Tautan konteks baru meminta konfirmasi jika ada isian belum disimpan. Sesi Champer aktif dipertahankan; tidak dibatalkan oleh navigasi. Target yang diklik tetap disimpan oleh handler existing sebelum navigasi portal.
- Tidak mengubah endpoint mutasi, mesin status sesi, penerima Apps Script, master spreadsheet, bridge lokal, kolektor, VB, Takebishi, atau PLC.
- Champer tetap `LINE_99` / `AUTO CHAMPER`. Total Welding mencakup Line 1–8, tidak termasuk Line 99. Line 99 dapat dipilih sendiri.

## Angka dashboard

- Katalog dari `/api/master`; katalog cadangan dilabeli, tidak dianggap sambungan master live.
- Hasil dari POST `/api/leader` action `snapshot` (read-only), fase target lalu laporan; permintaan berurutan. Maksimal 31 hari, shift 1/2/semua. Hanya tampil setelah seluruh periode lengkap. Gagal/batal tidak menghasilkan angka nol atau total parsial terselubung.
- OK dilaporkan: seluruh status laporan, bukan bukti produksi disetujui. OK terbit TF: hanya state `PUBLISHED`. Laporan dideduplikasi berdasarkan ID dalam snapshot tanggal–shift; target sekali per mesin–part pada snapshot. Mengikuti snapshot terkini, bukan rekonstruksi versi target historis.
- Jumlah hilang/invalid diberi penanda parsial. Belum ada laporan/target ditampilkan “—”; tidak dianggap mesin berhenti. Sumber ini adalah laporan existing termasuk alur manual.
- Counter live tetap menggunakan halaman `/monitor-live.html` dan cloud telemetry existing. Memuat portal tidak mengeluarkan permintaan Start/End atau pembacaan PLC.
- OEE/A/P/quality OEE/efisiensi belum dihitung dari data nyata karena waktu, CT dan interval berhenti belum lengkap. Tidak mengangkat metrik contoh pratinjau menjadi produksi.
- Mode TV enam mesin per layar, rotasi 15 detik. Hasil laporan dimuat manual; rotasi bukan polling laporan. Counter live memiliki polling existing tersendiri.

## Verifikasi

`tests/portal-production.cjs`: batas rentang, deduplikasi, pemisahan Line 99, data tidak lengkap, allowlist navigasi.
`scripts/portal-production-browser.cjs`: seluruh API dimock terisolasi, tidak memanggil PLC/cloud. Mencakup target→pemilihan→pairing→prepare/start/end, ID dan draft tetap, tampilan TV/telepon, form lama, laporan gagal parsial.
Seluruh pengujian backend existing tetap dijalankan. Uji pada produksi hanya baca dan navigasi; tidak membuat target/laporan/TF Slip uji baru.

## Panduan awal pengguna

1. Buka `/portal.html`; pilih tanggal/shift dan Line 99 Uji untuk pilot.
2. Target leader dan Pekerjaan operator tersedia dari sidebar. Gunakan sesi dan pairing tablet existing; tidak perlu membuka link manual.
3. Monitor Live Champer untuk counter mentah dan waktu penerimaan. Ringkasan/Performa untuk hasil laporan dan target; klik Muat hasil periode.
4. Form LKH dibuka melalui tombol atas dan tetap alur lama untuk mesin lain.

Rollback tampilan: tetap gunakan URL lama. Jika deployment bermasalah, pulihkan deployment produksi sebelumnya melalui Vercel; tidak perlu migrasi data atau pemulihan PLC.
