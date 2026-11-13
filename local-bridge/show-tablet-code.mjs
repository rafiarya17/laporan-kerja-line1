import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
try {
 const c=JSON.parse(readFileSync(join(root,'private','vercel-env.json'),'utf8'));
 console.log('Kode pemasangan tablet (khusus pengelola, jangan bagikan publik):');
 console.log(c.CHAMPER_TABLET_CODE);
 console.log('Masukkan di https://berlindo-lkh.vercel.app/champer-plc.html');
 console.log('Ini hanya menampilkan kode. Tidak membaca atau menulis PLC.');
} catch {console.error('Konfigurasi pemasangan belum tersedia. Jalankan 00-SIAPKAN.');process.exitCode=1;}
