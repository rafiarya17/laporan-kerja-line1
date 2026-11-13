# Penghubung cloud → kolektor lokal Champer

Implementasi pilot 11 November 2026 khusus LINE_99 AUTO CHAMPER. Mesin lain tetap memakai alur LKH saat ini. VB utama, konfigurasi Takebishi, dan program PLC tidak diubah.

## Alur

Tablet → API cloud → antrean/sesi Upstash Redis → penghubung PC mengambil permintaan lewat HTTPS keluar → API lokal v0.5 membuat snapshot START/END → kolektor R5/R7 membaca D100 melalui Takebishi → jurnal lokal → penghubung mengirim bukti dengan ID yang sama → sesi cloud.

Tidak perlu membuka port PC ke internet, port forwarding, atau akses PLC dari Vercel. Adapter hanya boleh POST `/api/v1/snapshot-requests` ke loopback, dengan item tetap D100. Tidak ada operasi poke/write/reset. D102/D104 tidak ditambahkan pada bridge ini.

## Batas pilot yang disengaja

- Sumber sebenarnya DDE, bukan angka simulator. Kesegaran sumber PLC tetap UNVERIFIED. Penerimaan DDE tidak membuktikan pembacaan baru pada PLC.
- Selisih D100 bersifat sementara. Belum ada gabungan D101, penanganan rollover/reset, atau pengesahan satu count = satu pcs. Counter turun, urutan salah, atau nilai di luar 0–9999 memerlukan pemeriksaan.
- OK/repair/reject/kendala disimpan sebagai input operator terpisah. Tidak otomatis dipaksa sama dengan selisih counter.
- Sesi pilot mempunyai ID UUID tersendiri. Setelah selesai, tombol terpisah dapat mengirim laporan UJI dengan ID tetap `LKH99-<UUID sesi>` melalui layanan penerima yang sudah ada. Retry membekukan payload dan memeriksa receipt ID yang sama. Laporan masuk antrean pemeriksaan leader; tidak otomatis disetujui atau dibuatkan TF Slip. Bukti counter dan versi target tetap tersimpan pada sesi cloud. Jumlah laporan berasal dari input kualitas operator, bukan klaim otomatis bahwa selisih D100 adalah output OK.
- Database pilot dibatasi 500 sesi, 2.000 permintaan baca, 10.000 aksi dan 4 MB agregat. Jika penuh, berhenti menerima pekerjaan baru sampai arsip/migrasi eksplisit; tidak menghapus bukti atau deduplikasi diam-diam. Untuk pemakaian produksi banyak mesin gunakan tabel terpisah dan retensi/backup terkelola.

## 1. Database gratis (langkah pengguna pertama)

1. Buka https://console.upstash.com/ dan masuk/daftar memakai akun Anda.
2. Buat **Redis database**, nama `berlindo-champer-pilot`, region Singapore bila tersedia, paket **Free**. Jangan memilih Pay as You Go.
3. Gunakan database milik akun, bukan database sementara tanpa akun yang dihapus setelah 72 jam.
4. Matikan eviction bila ada pilihan: bukti sesi tidak boleh terhapus otomatis ketika penuh. Jangan beri TTL pada key pilot.
5. Simpan REST URL dan REST Token di pengaturan Vercel, bukan chat/GitHub/browser. Token standar diperlukan server; readonly token tidak cukup.

Sumber resmi diperiksa 11 Nov 2026: https://upstash.com/pricing/redis — Free 256 MB, 500 ribu perintah/bulan dan 10 GB bandwidth. Batas bisa berubah. Polling memakai kuota: jalankan pilot saat pengujian, hentikan setelahnya; pantau pemakaian. Jika limit habis, pembacaan gagal/tertunda, tidak menggunakan nilai lama.
Dokumentasi REST dan persistensi: https://upstash.com/docs/redis/features/restapi dan https://upstash.com/docs/redis/features/durability . CAS dilakukan lewat EVAL atomik, tanpa TTL; kegagalan commit tidak diakui berhasil.

## 2. Konfigurasi lokal (setelah database siap, dipandu)

Ekstrak paket `CHAMPER-CLOUD-BRIDGE` ke folder baru, di luar VB utama/API lokal. Jalankan `00-SIAPKAN.cmd`, masukkan path lengkap `local-config.json` API v0.5 yang benar. Script hanya membaca file itu dan membuat konfigurasi di folder penghubung baru. Tidak menyalakan API/kolektor/PLC.

Script membuat `bridge-config.json` dan `private/vercel-env.json`. Folder private dan konfigurasi tidak boleh dipush ke GitHub. Token lokal tidak disalin ke cloud. Identitas API lokal dipasangkan berdasarkan path paket (hash), port 4331, dan collector ID, sehingga paket lain tidak diterima secara diam-diam.

## 3. Konfigurasi Vercel (server saja)

Project `berlindo-lkh`, environment **Production only**:

| Nama | Nilai |
|---|---|
| CHAMPER_REDIS_URL | REST URL database milik akun |
| CHAMPER_REDIS_TOKEN | REST token standar, sensitive |
| CHAMPER_DEVICE_TOKEN | dari private/vercel-env.json, sensitive |
| CHAMPER_TABLET_CODE | dari private/vercel-env.json, sensitive |
| CHAMPER_SOURCE_ID | dari private/vercel-env.json |
| CHAMPER_COLLECTOR_ID | dari private/vercel-env.json |
| CHAMPER_CLOUD_ENABLED | `1` setelah seluruh pemasangan siap |
| CHAMPER_REPORT_ENABLED | `1` untuk pengiriman laporan UJI ke pemeriksaan leader |

Jangan memakai awalan NEXT_PUBLIC untuk rahasia. Preview selalu nonaktif. Redeploy commit yang sudah diuji setelah environment terpasang. Tanpa konfigurasi lengkap, capabilities enabled=false dan pilihan Start/End simulasi tetap tersedia. Pengaktifan bukan pengesahan data produksi.

Tablet dipasangkan dengan kode 24 karakter melalui halaman pilot. Cookie HttpOnly/Secure berlaku 8 jam; kode tidak dikirim lewat URL. Ini akses perangkat bersama, bukan autentikasi identitas operator. Rotasi kode mencabut cookie tablet; rotasi token device memerlukan pembaruan config PC.

## 4. Uji nyata — satu langkah per giliran

1. Pastikan Takebishi/PLC tersedia dengan konfigurasi yang telah disetujui. Buka API lokal v0.5 dan kolektor review. VB utama dan review lama tidak diperlukan.
2. Connect D100 pada kolektor. Jangan Request/Auto Read untuk uji Start/End ini.
3. Buka `01-MULAI-PENGHUBUNG-CLOUD.cmd`. Tunggu READY. Script kedua akan menolak instance ganda lewat port loopback khusus 4349. API lokal punya penguncian instancenya sendiri.
4. Di tablet buka `/pekerjaan.html`, muat target leader, pilih **baca PLC Champer (pilot)**. Hanya muncul saat server configured. Pasangkan tablet dengan kode pengelola.
5. Pilih operator, Siapkan pekerjaan, lalu Mulai sekali. Tunggu status ACTIVE dan counter awal. Tindakan ini membuat satu snapshot baca, bukan start mesin.
6. Saat pekerjaan selesai, Akhiri sekali. Jika timeout, counter akhir tetap kosong dan pekerjaan masih menahan mesin; coba baca akhir lagi setelah koneksi siap. Jangan membuat sesi lain untuk mengganti sesi ini.
7. Isi kualitas/kendala. Simpan, lalu Selesaikan catatan pilot. Counter turun diblokir, tutup untuk pemeriksaan dengan alasan. Untuk mengirim ke leader, isi lembur serta waktu kendala bila ada, lalu Kirim laporan uji ke leader di riwayat sesi. Waktu proses harus memenuhi validasi laporan yang sudah ada, termasuk durasi minimal satu menit. Jangan mengganti tanggal target agar bukti sesi dari hari berbeda terlihat sah.
8. Refresh/tablet kedua: sesi yang sama tersimpan cloud. Tidak bisa memulai sesi Champer lain selagi sesi pertama terbuka.
9. Uji putus internet PC dilakukan terpisah setelah alur normal berhasil; jangan mematikan/reset PLC. Respons melewati deadline tidak mengubah batas sesi.
10. Hentikan penghubung lewat `02-HENTIKAN-PENGHUBUNG-CLOUD.cmd`; tunggu pesan berhenti. API, VB dan Takebishi tidak ditutup. Setelah itu hentikan sistem review lewat launcher sendiri bila selesai.

## Kontrak dan bukti

Browser: GET `/api/champer/capabilities`; POST `pair`; GET `state`; POST `operator` (prepare/start/end/quality/complete/close). Mutasi memakai requestId dan expected revision; prepare memvalidasi target/master LIVE di server.

PC: POST `poll` dan `result` dengan bearer device + source ID. Command fixed D100, lease 30 detik, deadline cloud 90 detik, snapshot lokal 30 detik. Agent menolak selisih jam >5 detik. Journal disimpan sebelum hasil dikirim; request_key lokal `CLOUD-<command UUID>` dipakai kembali pada retry. Tidak ada fallback ke summary/last value.

Pengujian otomatis memakai simulator API/kolektor dan database terisolasi; tidak membuktikan kondisi LAN/PLC. Uji nyata dan persistensi Upstash setelah pemasangan tetap diperlukan.
