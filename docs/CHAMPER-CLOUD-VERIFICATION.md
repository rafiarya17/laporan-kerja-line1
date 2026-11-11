# Verifikasi penghubung Champer — 11 November 2026

## Hasil lokal

- 88 pengujian otomatis lulus, 0 gagal. Meliputi alur laporan yang sudah ada, simulasi, state machine cloud, CAS database tiruan, konflik tablet, idempotensi, deadline, hasil terlambat, pemulihan jurnal, dan pembatasan D100.
- 7 pemeriksaan browser lulus: pemasangan tablet, muat ulang saat pending tanpa angka 0, Mulai/Akhiri, kualitas/penyelesaian, riwayat dan pengosongan form sesi berikutnya, lebar layar 390 px, serta fitur tetap nonaktif sebelum konfigurasi.
- Kontrak API lokal v0.5 diuji memakai implementasi SQLite yang dikirim sebelumnya, database `:memory:` dan event kolektor tiruan. START 7229, END 7234 diterima sebagai selisih sementara 5; ID snapshot yang sama digunakan kembali pada retry.
- Build produksi Next.js dan pemeriksaan TypeScript lulus.
- Pengujian tidak membaca jurnal produksi, tidak menjalankan VB, tidak menghubungi Takebishi/PLC dan tidak mengirim hasil produksi.

## Belum tersedia / perlu uji pemasangan

- Database cloud milik pengguna belum dibuat. Persistensi, kuota dan kredensial Upstash nyata belum diuji.
- Tidak ada kredensial PC/tablet yang dibuat atau diaktifkan. Endpoint cloud tetap tertutup sampai konfigurasi lengkap.
- Pembacaan dari tablet → Vercel → PC → Takebishi → PLC belum diuji. Uji ini dipandu setelah pemasangan.
- Hasil DDE tetap `UNVERIFIED` untuk kesegaran sumber PLC. Tidak ada konfirmasi timestamp dari PLC, reset/rollover D100, gabungan D101 atau pemetaan satu count ke pcs.
- Sesi cloud ini adalah pilot terpisah. Belum menerbitkan laporan LKH, revisi, TF Slip atau angka dashboard produksi.

## Reproduksi

Jalankan kompilasi tes (`tsc -p tsconfig.test.json`), lalu `node --test tests/*.cjs`. Untuk browser, gunakan Playwright dan `node scripts/champer-cloud-browser-smoke.cjs`; variabel `PLAYWRIGHT_MODULE` dan `PLAYWRIGHT_CHANNEL` dapat menunjuk instalasi yang tersedia. Script hanya membuka server mock loopback sementara.

`node scripts/champer-local-contract.cjs <path-core.mjs-API-v0.5>` membaca implementasi API yang diberikan dan membuat database dalam memori, tanpa menjalankan collector atau server yang sedang dipakai.
