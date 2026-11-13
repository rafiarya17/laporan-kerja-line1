import {createHmac,timingSafeEqual} from 'node:crypto';
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function issueCookie(secret:string,now=Date.now()) {const expiry=String(now+8*3600000);return expiry+'.'+createHmac('sha256',secret).update('champer-tablet:'+expiry).digest('hex');}
export function validCookie(value:string,secret:string,now=Date.now()) {const [expiry,mac]=value.split('.');return /^\d{13}$/.test(expiry||'')&&Number(expiry)>now&&Number(expiry)<=now+8*3600000&&equal(mac||'',createHmac('sha256',secret).update('champer-tablet:'+expiry).digest('hex'));}
