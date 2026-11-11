# Champer: jam aktual, lembur, dan riwayat — 11 November 2026

Dasar: branch rilis Champer `feat/champer-cloud-line99-release-20261111`, commit e90943d. Perubahan hanya web/API Champer Line 99 Uji. Tidak ada perubahan VB utama, collector, Takebishi, PLC, target leader, atau master.

## Alur operator

1. Daftar pekerjaan → sumber Target leader → tanggal/shift → Champer Line 99.
2. Satu tombol **Buka pekerjaan Champer**. Bila sudah ada riwayat, tampil **Mulai sesi baru · Champer**; sesi terbuka menampilkan **Lanjutkan sesi Champer**.
3. Siapkan → Mulai → Akhiri, dengan pembacaan D100 yang sudah ada.
4. Setelah counter akhir diterima, periksa tanggal/jam mulai dan selesai aktual WIB. Nilai awal berasal dari timestamp pembacaan; operator harus mengonfirmasi, bukan dianggap otomatis benar.
5. Pilih lembur Ya/Tidak. Jika jam berbeda dari bukti pembacaan, isi alasan. Centang konfirmasi dan simpan jam aktual.
6. Simpan kualitas/kendala → selesaikan catatan → isi jam kendala bila ada → kirim laporan ke leader. Laporan memakai jam aktual dan lembur yang tersimpan.
7. Riwayat dapat difilter tanggal, shift, status, part/operator/ID. Target lama tetap bisa dipakai lagi dengan sesi/ID baru setelah sesi sebelumnya ditutup.

Simulasi hanya ditawarkan melalui sumber **Contoh simulasi**. Target leader nyata tidak dialihkan ke simulasi ketika penghubung tidak tersedia. Mesin lain tetap memakai form laporan lama.

## Aturan data

- `workTime` terpisah dari timestamp/counter START dan END. Koreksi jam tidak mengoreksi jumlah counter, reset, atau pembacaan PLC.
- Alasan dan nilai jam aktual disalin ke audit sesi. Update menggunakan revision dan request ID, termasuk deduplikasi pengiriman ulang.
- Waktu mulai/akhir wajib valid, >0 sampai 16 jam, dan sudah berlangsung (toleransi jam 5 menit sesuai validasi laporan).
- Tanggal produksi/shift mengikuti aturan laporan yang sudah ada. Shift 2 mendukung lintas tengah malam. Tanggal aktual yang tidak dapat dipetakan persis ke laporan ditolak, tidak digeser diam-diam.
- Jadwal jam normal tiap shift belum dijadikan sumber aturan baru. Lembur dikonfirmasi operator dan masuk alur pemeriksaan leader yang sudah ada, bukan otomatis disimpulkan dari tombol End.
- Bila End terlambat dan counter bertambah di luar jam kerja sebenarnya, koreksi jam saja tidak dapat memisahkan jumlah tersebut. Pesan UI mengarahkan pemeriksaan leader.
- Laporan yang sudah direservasi/terkirim tetap beku dan menggunakan ID `LKH99-<session-id>` yang sama. Sesi selesai lama yang belum punya jam aktual dapat melengkapi jam sebelum pertama kali mengirim laporan.
- Penanda pernah dikerjakan berdasarkan tanggal/shift/line/mesin/part, termasuk target versi sebelumnya. Target tidak dinonaktifkan setelah satu sesi.
- Riwayat menampilkan seluruh sesi dalam kapasitas pilot yang sudah dibatasi 500 sesi. Tidak menghapus audit/dedupe, tidak hanya mengambil 100 terbaru.
- Status “Terkirim ke leader” berarti receipt antrean diterima; bukan klaim disetujui atau selesai TF Slip.

## Uji terisolasi

- Unit/integrasi: validasi jam, shift malam, koreksi tanpa mengubah counter, konfirmasi lembur wajib, deduplikasi, laporan memakai waktu aktual, laporan lama beku, reuse target dan riwayat >100 sesi.
- Browser: pairing, Start/End, simpan waktu aktual, kualitas, riwayat/filter, sesi berikutnya, pemisahan sumber contoh/nyata, layar kecil.
- Tidak membaca/menulis PLC atau mengirim laporan uji ke receiver nyata selama pengujian otomatis.

## Catatan dashboard untuk tahap berikutnya

Pengguna meminta pembahasan dashboard disimpan sementara, dan memprioritaskan alur pekerjaan Champer ini. Dashboard existing adalah Looker Studio, detail line/mesin/part. Pertimbangan tahap berikutnya: pertahankan rekap historis tervalidasi di Looker; pertimbangkan monitor operasional di web yang sama untuk counter sementara serta MTC/Dandori. Ini belum merupakan implementasi atau keputusan final migrasi dashboard. Pembacaan D100 cloud saat ini tetap Start/End; MTC/Dandori live cloud dan sampling berkala belum ditambahkan oleh perubahan ini.
