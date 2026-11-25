# Membetulkan peringatan CT di Pemeriksaan Web

Buka **Pemeriksaan & TF Slip → Laporan Web App → Perlu perhatian → Periksa / revisi**. Detail menampilkan total output, output standar, CT yang dipakai, tanggal katalog, dan menit operasional. Leader tetap dapat menyetujui hasil yang sudah diperiksa.

- **Qty atau jam laporan keliru.** Koreksi qty, jam proses, atau jam kendala pada laporan yang sama. Isi alasan, simpan, lalu muat ulang. Jika laporan masih menunggu leader, gunakan **Simpan koreksi & setujui**.
- **CT master keliru.** Pilih baris aktif dengan line, mesin, dan part standar yang tepat di tab **MASTER_CT**. Isi **CYCLE_TIME_SECONDS** dalam detik per pcs. Untuk Long Pipe, periksa **LONG_PIPE_SPEED_MM_PER_SECOND** dan **LONG_PIPE_LENGTH_MM**. Web menghitung detik per batang dari panjang dibagi kecepatan. [Buka MASTER_CT](https://docs.google.com/spreadsheets/d/10Q7RGTWIayN1Z5zN446lWEBIdI8kg4-MzGAajfmaIGc/edit#gid=1002)

## Memperbarui katalog web setelah master berubah

1. Buka tab **MASTER_CT** di Google Sheets, lalu unduh tab lengkap sebagai CSV.
2. Dari repositori aplikasi, buat SQL dengan perintah berikut. Ganti tanggal dengan tanggal salinan master dan sesuaikan nama berkas.

   ```sh
   python3 scripts/review-ct-catalog.py MASTER_CT.csv --date 2026-11-25 > sinkron-ct.sql
   ```

3. Admin memeriksa jumlah CT dan pasangan aktif yang dicetak perintah, lalu menjalankan isi berkas SQL di Neon SQL Editor pada database **berlindo_lkh** di proyek **berlindo-lkh-production**. Hasil satu baris berisi tanggal menandakan katalog berhasil diperbarui. Jika tidak ada baris, periksa tanggal salinan dan database tujuan.
4. Muat ulang Pemeriksaan Web. Buka kembali laporan yang sama dan cocokkan CT, tanggal master, dan angka standar. Katalog berlaku untuk pemeriksaan dan perhitungan target baru. Pembacaan ulang laporan lama menggunakan CT terkini. Update katalog tidak mengubah qty laporan atau target yang sudah disimpan.
5. Jika perubahan CT juga perlu berlaku di Data Mart Google Sheets, jalankan sinkronisasi master Data Mart yang sudah digunakan admin. Sinkronisasi katalog Neon dan sinkronisasi Data Mart adalah dua proses terpisah.
