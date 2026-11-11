import {createInterface} from 'node:readline/promises';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {atomic} from './bridge-client.mjs';
const root=dirname(fileURLToPath(import.meta.url)),file=join(root,'bridge-config.json');
if(existsSync(file)){console.log('Konfigurasi sudah ada; tidak diganti.');process.exit(0);}
const ask=createInterface({input:process.stdin,output:process.stdout});
try{
 const localConfigPath=resolve((await ask.question('Lokasi lengkap local-config.json API v0.5 yang digunakan: ')).trim().replace(/^"|"$/g,''));
 const local=JSON.parse(readFileSync(localConfigPath,'utf8'));
 if(local.port!==4331||typeof local.collectorId!=='string'||typeof local.token!=='string')throw Error('Bukan konfigurasi API v0.5');
 const c={cloudOrigin:'https://berlindo-lkh.vercel.app',localConfigPath,collectorId:local.collectorId,packageKey:createHash('sha256').update(dirname(localConfigPath).toLowerCase()).digest('hex'),sourceId:randomUUID(),deviceToken:randomBytes(32).toString('hex')};
 const tabletCode=randomBytes(12).toString('hex');
 atomic(file,c);atomic(join(root,'private','vercel-env.json'),{CHAMPER_CLOUD_ENABLED:'1',CHAMPER_SOURCE_ID:c.sourceId,CHAMPER_DEVICE_TOKEN:c.deviceToken,CHAMPER_TABLET_CODE:tabletCode,CHAMPER_COLLECTOR_ID:c.collectorId});
 console.log('Konfigurasi dibuat terpisah. Rahasia pemasangan ada di private\\vercel-env.json. Jangan unggah file ini ke GitHub atau kirim lewat chat.');
 console.log('Belum ada koneksi atau pembacaan PLC. Lanjutkan panduan konfigurasi database dan Vercel.');
}finally{ask.close();}
