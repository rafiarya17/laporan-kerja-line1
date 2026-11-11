# Verifikasi penghubung Champer — 11 November 2026

## Pemeriksaan sebelum deploy

- 98 tes otomatis lulus, 0 gagal: pembatasan Line 99 / D100, konflik tablet, deadline, data terlambat, CAS, antrean/jurnal, pemulihan setelah respons hilang, ID laporan tetap dan alur laporan lama.
- Build produksi Next.js (webpack) dan TypeScript lulus.
- Kontrak dengan implementasi API lokal v0.5 lulus memakai SQLite dalam memori, tanpa menjalankan kolektor: START 7229, END 7234, selisih sementara 5.
- Browser diuji melalui server mock loopback: pemasangan, pilih target, Start, refresh saat pending, End timeout (tetap kosong), retry pada sesi sama, hasil 100 → 112, kualitas 12/0/0, penyelesaian, draft lembur bertahan saat muat ulang data, laporan LKH99 tetap satu ID, receipt dan riwayat bertahan setelah refresh halaman.
- Uji laporan browser memakai penerima tiruan, tidak mengirim laporan ke spreadsheet/leader sebenarnya.

## Pemasangan

Database Upstash berlindo-champer-pilot sudah dibuat. REST URL/token dan identitas pasangan PC/tablet disimpan sebagai rahasia Vercel Production saja. Paket PC terpisah CHAMPER-CLOUD-BRIDGE-v0.2 dipasangkan ke API lokal v0.5 yang dipakai di workspace outputs. Token lokal tidak dikirim ke cloud.

## Batas bukti

Belum membuktikan pembacaan aktual tablet → cloud → kolektor → Takebishi → PLC. Uji nyata perlu dilakukan pengguna setelah pemasangan; tidak ada pembacaan PLC otomatis saat deploy. Freshness DDE tetap UNVERIFIED, selisih D100 tetap pilot. Reset/rollover, D101, satu count per pcs belum diverifikasi. Persetujuan leader / revisi / TF Slip mempertahankan alur lama dan belum diuji dengan laporan baru dari tablet.

Reproduksi: tsc -p tsconfig.test.json; node --test tests/*.cjs. Kontrak lokal: node scripts/champer-local-contract.cjs <core.mjs API v0.5>. Browser mock: node scripts/champer-cloud-browser-smoke.cjs --serve-only lalu buka /test pada port yang dicetak. Semua data fixture dalam memori.
