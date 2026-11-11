# Konteks sistem Berlindo untuk ChatGPT Desktop

Tanggal: 11 November 2026. Dokumen ini menjelaskan sistem yang sudah berjalan dan batas pekerjaan selanjutnya. Integrasi PLC dan sesi kerja hybrid BELUM diimplementasikan dalam perubahan hosting ini.

## 1. Instruksi pemilik dan batas pekerjaan

Pemilik ingin ChatGPT Desktop pada PC yang sudah terhubung ke PLC mengembangkan alur hybrid KHUSUS mesin champer. Mesin lainnya tetap menggunakan Google Form / web form LKH dan proses produksi yang berjalan sekarang.

Gambaran kebutuhan champer: leader mengisi target tanggal, shift, line, mesin, part dan qty; operator mulai sesi kerja di shopfloor; hasil mesin berasal dari pembacaan PLC yang sudah ada pada PC; saat akhir pekerjaan operator mengakhiri sesi di tablet dan tetap mengisi repair, reject, serta keterangan kendala bila ada. Detail rancangan, discovery PLC dan implementasi berikutnya menjadi tugas sesi Desktop.

Mulai/akhir sesi merupakan pencatatan pekerjaan. Permintaan ini tidak menginstruksikan menulis coil/register PLC atau mengendalikan start/stop mesin.

Snapshot master lama dalam repo memuat `AUTO CHAMPER` dan `MANUAL CHAMPER` pada LINE_1. Ini bukan bukti mesin yang tersambung ke PLC saat ini. Cocokkan mesin fisik, identitas pada master LIVE, dan kode penghubung lokal. Jangan mengaktifkan seluruh mesin dengan pencocokan kata "CHAMPER" saja.

## 2. Repo dan hosting

- Repository: https://github.com/rafiarya17/laporan-kerja-line1 (fork milik pengguna; repo publik).
- Branch handoff: `feat/leader-workspace-vercel-20261111`.
- Basis produksi sebelum migrasi: `91f9d8a11ed9a479e9b7f7b444bc0d4f463119d7`, berasal dari `fix/submission-confirmation-20261110`.
- `main` belum merupakan acuan produksi terbaru saat pemeriksaan ini. Mulai dari branch handoff, bukan clone main lalu menimpa versi terbaru.
- Vercel project: `berlindo-lkh`, account/team `rafiarya17`.
- Form operator: https://berlindo-lkh.vercel.app/
- Dashboard leader hasil migrasi: https://berlindo-lkh.vercel.app/leader
- Dashboard lama: https://berlindo-miniapp-lab.smartboy1.chatgpt.site/leader
- Dashboard lama tetap tersedia. Backend dan data kedua dashboard sama; jangan membuat target/laporan ganda untuk migrasi.
- Migrasi ini menambahkan frontend leader di repo yang sama dengan form operator. Tidak memindahkan spreadsheet atau Apps Script ke Vercel.
- Telegram bot yang berjalan masih menggunakan URL dashboard lama pada konfigurasi Apps Script. Preview tombol Telegram di dashboard Vercel mengarah ke host Vercel. Penggantian URL pesan/menu bot merupakan pekerjaan terpisah, bukan otomatis oleh deploy frontend.

Untuk melanjutkan: fetch branch handoff, buat feature branch khusus champer, commit perubahan, tes, kemudian deploy commit tertentu ke project yang benar. Jangan force-push atau menimpa perubahan sesi lain. Periksa konfigurasi Git deployment pada Vercel; jangan berasumsi setiap push otomatis menjadi produksi. Publikasi ini menggunakan deployment dari commit GitHub tertentu.

## 3. Peta kode yang ada di GitHub

| Lokasi | Fungsi |
| --- | --- |
| `app/page.tsx` | Form operator, multioperator/helper, draft, pending ID, retry dan receipt |
| `app/api/master/route.ts` | Master LIVE; fallback snapshot untuk tampilan saja ketika backend tidak siap |
| `app/api/submissions/route.ts` | Penerimaan form operator, validasi origin/ukuran dan pemanggilan layanan |
| `app/api/leader/route.ts` | Gateway dashboard untuk snapshot, target, submit uji, decide dan decideBatch |
| `app/api/line99/route.ts` | Gateway pilot Telegram terdahulu; jangan dihapus karena migrasi UI |
| `lib/lkh.ts` | Kontrak Submission/LkhForm/Receipt, validasi tanggal, shift, qty, kendala |
| `lib/submission-service.ts` | Receipt lookup, retry dengan ID sama, penerimaan yang dapat dikonfirmasi |
| `lib/receiver.ts` | Pemilihan production/test, envelope HMAC ke Apps Script dan timeout |
| `constants/formMapping.json` | Snapshot fallback, bukan sumber master terkini |
| `public/leader.html` | Markup dashboard leader |
| `public/leader.css` | Tampilan responsif desktop/tablet/HP |
| `public/leader.js` | State UI, target, detail/revisi, bulk, pending command dan refresh manual |
| `public/leader-core.js` | Penghitungan target, laporan unik dan qty |
| `public/leader-card.js` | Formatter ringkasan Telegram pada web |
| `next.config.ts` | Rewrite `/leader` ke `/leader.html`; root tetap form operator |
| `tests/*.cjs` | Pengujian validasi, intake, receiver dan submission |

Framework saat migrasi: Next.js 16.4.3 / React 19.3.0. Baca `AGENTS.md` dan dokumentasi versi Next di `node_modules/next/dist/docs/` sebelum mengubahnya.

Backend Apps Script live adalah proyek terpisah. Repo publik memuat beberapa sumber/tests Apps Script historis; jangan menganggap semuanya identik dengan deployment live. File penting di proyek private/live: `LeaderWorkspaceNov10.gs`, `Line99PilotNov5.gs`, `EventDrivenOct19.gs`, serta `Code.gs` di receiver. Baseline terakhir yang telah diverifikasi pada 10 November: receiver deployment v16 merujuk library AndonPilot v10. Project HEAD juga memiliki pembaruan formatter Telegram yang dijalankan trigger. Verifikasi versi live lagi sebelum perubahan Apps Script; mengedit HEAD tidak otomatis memperbarui library atau web app deployment.

Jangan menaruh token Telegram, HMAC secret, `.env`, alamat/IP internal PLC atau salinan spreadsheet produksi dalam repo publik. Vercel sudah memiliki konfigurasi runtime; gunakan koneksi pemilik, tidak perlu mengirim secret melalui chat. Kode browser tidak boleh memiliki secret.

## 4. Alur input LKH saat ini

1. Operator mengisi laporan yang sudah selesai, melalui Google Form atau web form. Web form belum memiliki Start/End session maupun pembacaan PLC.
2. Web mengambil master LIVE. Bila hanya snapshot tersedia, tampilan tetap dapat dibaca tetapi pengiriman baru tidak dinyatakan siap.
3. Web membuat ID stabil: produksi `LKH-<UUID>`; pilot `LKH99-<UUID>`. Payload pending disimpan di browser sebelum dikirim.
4. `/api/submissions` memanggil Apps Script dengan envelope HMAC. Validasi master dan isi dilakukan sebelum laporan baru diterima.
5. Receiver mencatat receipt dan source response, lalu intake STAGE ke antrean Andon. Retry melanjutkan/mengonfirmasi laporan yang sama, bukan membuat source/antrean ganda.
6. Worker memproses normalisasi/validasi, tampilan Cek Output Leader, dan penerbitan melalui jalur produksi yang sudah ada.
7. Line produksi 1–8 tetap pada pengaturan auto-approval yang sudah berjalan. Dashboard leader menampilkannya sebagai view-only. Pilot Line 99 menunggu tindakan leader.
8. `QUEUED` hanya bukti diterima ke jalur pemrosesan; bukan bukti sudah ada pada TF Slip. UI menampilkan `PUBLISHED` setelah versi laporan ditemukan pada DATA PRODUKSI TF Slip.

Google Form memiliki jalur intake event tersendiri yang berujung ke pipeline bersama. Menulis baris langsung ke sheet tidak sama dengan memicu Google Form submit. Jalur web memakai receiver eksplisit; jangan membuat fitur baru hanya append sheet lalu berharap trigger form berjalan.

Source row dapat berpindah. Cari menggunakan ID, jangan menyimpan nomor baris sebagai identitas permanen. Source yang sudah dihapus tidak boleh diciptakan ulang diam-diam saat retry.

## 5. Target leader dan definisi angka

- Konteks target: tanggal produksi + shift + line. Item: mesin + part, dengan target OK qty per item.
- Penyimpanan target memakai versi, `expectedVersion`, `requestId`, hash dan alasan perubahan. Versi lama ditolak bila sudah ada perubahan lain.
- Journal sheet: `LEADER_TARGETS_V1`; latest version per tanggal–shift–line dipakai untuk tampilan.
- Satu part–mesin dikerjakan dua laporan berbeda = satu item target terpenuhi, dua submissions; hasil OK laporan unik dijumlah.
- Satu laporan berisi operator + helper = satu submission. Qty tidak dikali jumlah operator.
- Telegram menghitung kelengkapan ITEM, bukan jumlah qty sebagai target utama. Qty tetap terlihat di dashboard.
- Semua item sudah dilaporkan tidak sama dengan target qty tercapai, tidak sama dengan disetujui, dan tidak sama dengan terbit TF.
- Laporan "di luar target" berarti tidak cocok dengan target yang DIISI LEADER untuk tanggal/shift itu; bukan otomatis salah atau di luar planning PPC.
- Shift 2 melewati tengah malam. Tanggal produksi tetap konteks shift, tidak diganti otomatis menjadi tanggal kalender pagi saat submit.

## 6. Dashboard leader saat ini

- Tanpa login sesuai permintaan pemilik. Nama leader diinput sendiri dan dicatat sebagai self-declared; bukan identitas terverifikasi. CORS/origin allowlist bukan autentikasi pengguna.
- Target dapat diisi untuk Line 1–8 dan Line 99. Mutasi laporan melalui dashboard (approve/revise/hold) masih dibatasi Line 99.
- Refresh saat halaman dibuka, konteks berubah atau tombol Muat ulang ditekan. Tidak ada polling otomatis setiap 15 detik.
- Snapshot dimuat bertahap: `phase:targets`, lalu `phase:reports`, dengan konteks tanggal/shift/line. Target dapat digunakan sebelum laporan selesai dimuat.
- Laporan eligible bisa disetujui langsung dari card/detail atau melalui checkbox/bulk, maksimal 20 per permintaan bulk.
- Setelah command tersimpan lokal, panel detail ditutup dan status pengiriman terlihat di daftar. Respons yang terlambat tidak menutup detail laporan lain.
- Request yang belum terkonfirmasi tetap mempertahankan ID; tersedia retry ID sama. Jangan mengganti ID hanya karena timeout.
- Perintah revisi/approve memakai `expectedHash` agar versi yang sudah berubah tidak ditimpa.
- UI baru responsif 320–1280px dan sudah diuji pada browser. Perubahan hosting mempertahankan tampilan ini.

State yang terlihat: `RECEIVED`, `WAITING_LEADER`, `HELD`, `PUBLISH_QUEUED`, `WAITING_TF_SYNC`, `PUBLISHED`; laporan asli view-only memakai `PRODUCTION_VIEW` beserta `productionState`.

Saat ganti host, localStorage browser tidak ikut pindah. Target/laporan server tetap sama, tetapi draft dan pending request di host lama tetap di host lama. Selesaikan retry yang belum terkonfirmasi dari asalnya; jangan menginput ulang laporan sebagai ID baru hanya karena berpindah URL.

## 7. Antrean, durasi dan Telegram

- Lock pendek melindungi perubahan bersamaan pada resource bersama. Penantian HTTP tidak menjamin worker sudah menerapkan keputusan.
- Pemrosesan awal masih asinkron. Uji sebelumnya pernah menunjukkan sekitar lima menit untuk STAGE; angka itu observasi, bukan SLA dan bukan jaminan durasi saat ini.
- Pindah hosting ke Vercel tidak dengan sendirinya menghilangkan delay Apps Script/Sheets.
- Ada jalur penerimaan laporan operator dan perintah leader; jangan menambah lapisan antrean kedua untuk laporan yang sama tanpa kebutuhan jelas.
- Bot: `@Notifikasi_Problem_Bot` (Berlindo Bot), grup Work Order.
- Satu card per tanggal produksi + shift, diperbarui lewat edit pada message yang sama. Pengiriman terpisah dari request input/approval.
- Trigger `line99RefreshCards` yang sudah ada dipakai. Jangan membuat trigger duplikat.
- Hijau menunjukkan semua item target sudah dilaporkan; warning menunjukkan kekurangan/perhatian; publikasi TF ditampilkan terpisah.
- Signature mencakup teks + tombol. Pesan yang isinya sama tidak diedit ulang.

## 8. Kontrak API yang tersedia, bukan API PLC

`POST /api/leader` menerima:
- `{ action: 'snapshot', phase: 'targets' | 'reports', date, shift, line }`
- `{ action: 'target', leader, payload: { requestId, date, shift, line, expectedVersion, items: [{ machine, part, targetQty }], reason } }`
- `{ action: 'decide', leader, payload: { requestId, id, expectedHash, decision: 'approve' | 'revise' | 'hold', reason, fields? } }`
- `decideBatch` dengan payload.commands (maksimal 20).
- `submit` khusus input pilot; lihat implementasi lengkap sebelum mengirim.

`POST /api/submissions`: `{ id, line, form }`, sesuai `Submission` di `lib/lkh.ts`. Daftar field lengkap ada pada `initialForm`; operator merupakan array, bukan qty multiplier. Jangan memanggil API ini saat Mulai sesi dengan laporan belum selesai: validator sekarang menuntut waktu/hasil laporan yang valid.

Belum ada API sesi, penyimpanan counter PLC, pemetaan PLC-ke-mesin, atau status RUNNING sesi pekerjaan pada aplikasi ini. Pengembang Desktop perlu menambahnya dengan cakupan champer yang eksplisit, tanpa mengubah kontrak LKH mesin lain.

Preview deployment sengaja tidak boleh mewarisi jalur tulis production. Gateway leader memerlukan konfigurasi production dan origin yang diizinkan. Preview dapat menampilkan UI namun tidak otomatis memiliki akses data live; jangan menonaktifkan pengamanan itu sekadar agar preview berhasil.

## 9. Titik yang harus ditemukan oleh sesi Desktop

Baca kondisi lokal terlebih dahulu: aplikasi/driver PLC yang sudah ada, protokol, identitas mesin, counter/tag yang tersedia, arti hitungan dan perilaku reset. Tidak ada kepastian apakah hitungan menunjukkan cycle, gross quantity atau OK; jangan menebak formula OK = counter - repair - reject sebelum maknanya disepakati.

Pastikan pengembangan hanya untuk mesin champer terpilih. Dua laporan pada mesin/part yang sama dan satu laporan berisi beberapa operator harus tetap didukung tanpa double count. Perlakukan helper sebagai anggota pekerjaan.

Jaga ID stabil dan audit revisi, perubahan master, shift lintas hari, retry/disconnect, dan pemisahan data mentah mesin dari koreksi leader. Tidak perlu menulis setiap pembacaan PLC ke response sheet atau membuat sebuah LKH untuk setiap pulse.

Sebelum mengaktifkan hybrid pada mesin aktual, uji dengan dummy/adaptor simulasi dan alur Line 99. Bila persetujuan leader untuk champer asli juga hendak diaktifkan, itu perlu perubahan backend yang dibatasi pada mesin tersebut; status sekarang tidak mendukung mutasi produksi asli dari dashboard.

## 10. Cara kolaborasi antar sesi

Sesi ChatGPT cloud dan Desktop tidak berbagi memori proses, filesystem, koneksi PLC atau login secara otomatis. Repo/branch/commit dan dokumen ini adalah titik serah-terima. Desktop harus memiliki akses GitHub/Vercel pada sesinya sendiri atau checkout lokal yang sah.

Sebelum mengedit: fetch branch handoff, baca AGENTS.md, cek diff/status dan deployment terbaru. Sesudah mengedit: commit, laporkan SHA, daftar file, tes, deployment/URL, dan apa yang masih belum diaktifkan. Kerjakan feature branch sendiri agar dua sesi tidak menimpa commit.

Perubahan hosting ini hanya menambahkan dashboard leader. Form operator, receiver, trigger, akses, target yang tersimpan dan TF Slip tidak dimigrasi atau diubah oleh langkah tersebut.
