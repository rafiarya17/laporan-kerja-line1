# Portal terpadu — 13 November 2026

Pintu masuk `/portal.html`. URL lama `/`, `/leader`, `/pekerjaan.html`, `/champer-plc.html`, dan `/monitor-live.html` tetap berfungsi. Form LKH tetap halaman tersendiri; tidak dipindah ke iframe atau diubah kontrak penyimpanannya.

## Batas perubahan

- Menu memakai navigasi dokumen langsung, tanpa iframe. Halaman hanya memuat skripnya sendiri. Sidebar dan gaya visual bersama berlaku pada leader, pekerjaan, sesi, monitor live dan latihan. Form LKH tetap halaman terpisah.
- Perpindahan menu menghentikan halaman sebelumnya; tidak ada aplikasi tersembunyi yang terus melakukan polling. Monitor Live melakukan GET telemetry setiap 5 detik ketika terlihat; sesi berhenti polling saat tab tersembunyi. Backend/kolektor tetap bekerja independen.
- Cookie pairing, ID laporan, ID permintaan pending dan penyimpanan server tidak diganti. Navigasi/reload membaca ulang status server; tidak mengirim Start/End otomatis.
- Draf target disimpan di sessionStorage dengan tanggal/shift/line dan versi server. Draf versi lama tidak diterapkan ke target versi baru. Kualitas/jam aktual memakai ID sesi dan revisi; konfirmasi jam harus dicentang lagi setelah kembali. Revisi leader memakai ID laporan dan hash. Nama leader serta pilihan operator juga dipertahankan pada tab yang sama. Token/kode pairing tidak ikut disimpan sebagai draf.
- Tidak ada penghapusan atau migrasi data. Backend/API dan alur LKH manual tetap sama.
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
`scripts/portal-native-browser.cjs` (juga dipanggil oleh `scripts/portal-production-browser.cjs`): seluruh API dimock terisolasi, tidak memanggil PLC/cloud. Mencakup target→pairing→prepare/start/end→jam aktual→kualitas→laporan→revisi leader/TF, retry Start dengan ID sama, draft, pergantian halaman tanpa frame, penghentian polling Live, tampilan TV/telepon dan form lama. Bukti tersimpan di `verification/portal-native-browser.json`.
Seluruh pengujian backend existing tetap dijalankan. Uji pada produksi hanya baca dan navigasi; tidak membuat target/laporan/TF Slip uji baru.

## Panduan awal pengguna

1. Buka `/portal.html`; pilih tanggal/shift dan Line 99 Uji untuk pilot.
2. Target leader dan Pekerjaan operator tersedia dari sidebar. Gunakan sesi dan pairing tablet existing; tidak perlu membuka link manual.
3. Monitor Live Champer untuk counter mentah dan waktu penerimaan. Ringkasan/Performa untuk hasil laporan dan target; klik Muat hasil periode.
4. Form LKH dibuka melalui tombol atas dan tetap alur lama untuk mesin lain.

URL lama kini membuka halaman langsung dengan navigasi portal; tautan lama tetap kompatibel. Jika deployment bermasalah, pulihkan deployment produksi sebelumnya melalui Vercel; tidak perlu migrasi data atau pemulihan PLC.

## Uji lapangan setelah penerbitan

1. Buka portal dan Monitor Live Champer, pasangkan browser bila diminta. Halaman ini hanya mengambil telemetry cloud yang sudah dikirim penghubung.
2. Pastikan status penghubung dan waktu penerimaan terbaru. Nilai lama tetap dilabeli histori; jangan anggap UNKNOWN sebagai nol.
3. Saat operator/leader menjalankan mesin sesuai prosedur lapangan, amati perubahan nilai. Bukti jeda hanya PC DDE → cloud → layar; tidak mengukur sensor → PC.
4. Dengan target UJI Line 99, lanjutkan pekerjaan → Start → End → jam aktual/lembur → kualitas/kendala → laporan → pemeriksaan leader → TF Slip. Tidak mengubah atau mereset PLC.
5. Filter ringkasan ke tanggal/shift dan Line 99; muat hasil. Total Welding Line 1–8 tetap tidak memasukkan data uji.
