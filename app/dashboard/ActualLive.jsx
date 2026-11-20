import React, { useEffect, useState } from 'react';
import { fmt } from './metrics';

const time = new Intl.DateTimeFormat('id-ID', {timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'medium'});

export function ActualLive() {
  const [reading, setReading] = useState(null);
  const [status, setStatus] = useState('Memeriksa penghubung cloud…');
  useEffect(() => {
    let active = true, inFlight = false;
    const controller = new AbortController();
    let timeout;
    let currentRequest;
    async function read() {
      if (document.hidden || inFlight) return;
      inFlight = true;
      currentRequest = new AbortController();
      timeout = setTimeout(() => currentRequest.abort(), 10000);
      try {
        const response = await fetch('/api/champer/telemetry', {cache:'no-store', signal:currentRequest.signal});
        if (!active) return;
        if (response.status === 401) {
          setReading(null);
          setStatus('Pasangkan browser ini di Monitor Live Champer untuk menampilkan counter.');
          return;
        }
        if (!response.ok) throw new Error();
        const {telemetry,serverTime,machine,line} = await response.json();
        if (!active) return;
        if (machine !== 'AUTO_CHAMPER' || line !== 'LINE_99') throw new Error();
        const r = telemetry?.reading;
        if (!r || !Number.isSafeInteger(r.value) || !Number.isFinite(r.observedAt)) {
          setReading(null);
          setStatus('Menunggu pembacaan pertama dari penghubung.');
          return;
        }
        const age = serverTime - r.observedAt;
        const recent = serverTime - telemetry.receivedAt < 30000 && telemetry.localReady &&
          telemetry.status === 'READ_OK' && age >= -5000 && age < 15000;
        setReading({value:r.value,observed:r.observedAt});
        setStatus(recent ? 'Pembacaan DDE baru diterima · Kesegaran PLC belum terverifikasi' : 'Menunggu pembacaan baru');
      } catch {
        if (active) setStatus('Penghubung cloud belum dapat diperiksa.');
      } finally {
        clearTimeout(timeout);
        inFlight = false;
      }
    }
    read();
    const timer = setInterval(read, 5000);
    document.addEventListener('visibilitychange', read, {signal:controller.signal});
    return () => {active=false; clearInterval(timer); clearTimeout(timeout); currentRequest?.abort(); controller.abort();document.removeEventListener('visibilitychange', read);};
  }, []);
  return <div className="field-live"><section className="zone pilot-zone">
    <header><h3>Line 99 Uji</h3><span>1 mesin · Kolektor Champer</span></header>
    <h2>AUTO CHAMPER</h2><p role="status">{status}</p>
    <span>Counter D100 terakhir</span><strong className="pilot-count">{fmt(reading?.value)}</strong>
    {reading && <p>Diterima PC {time.format(reading.observed)} WIB</p>}
    <small>Counter kumulatif mesin. Output sesi dihitung dari counter awal dan akhir pekerjaan.</small>
    <a href="/monitor-live.html">Buka Monitor Live Champer dan pemasangan browser ↗</a>
  </section></div>;
}
