"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { OperatorActor } from "@/lib/operator-directory";

type State = {enabled:boolean; actor:OperatorActor|null};
type Actions = { finish:(message:string)=>void; switchUser:()=>Promise<void>; refresh:()=>Promise<void> };
export function OperatorAccess({children}:{children:(actor:OperatorActor|null,actions:Actions)=>ReactNode}) {
  const [state,setState]=useState<State|null>(null);
  const [nik,setNik]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    try {
      const res=await fetch("/api/operator-session",{cache:"no-store"});
      if(!res.ok)throw Error();
      const next=await res.json();
      if(typeof next.enabled!=="boolean")throw Error();
      setState(next);setError("");
    }catch{setState(null);setError("Status login belum tersedia. Periksa koneksi dan coba lagi.");}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const finish=useCallback((text:string)=>{setNik("");setState({enabled:true,actor:null});setError("");setMessage(text);window.scrollTo(0,0);},[]);
  const switchUser=useCallback(async()=>{
    try {
      const res=await fetch("/api/operator-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"logout"})});
      if(!res.ok)throw Error();
      finish("Silakan masuk dengan NIK kerja.");await refresh();
    }catch{setError("Belum berhasil keluar. Periksa koneksi dan coba lagi.");}
  },[finish,refresh]);
  useEffect(()=>{
    if(!state?.actor)return;
    const check=()=>{if(document.visibilityState==="visible")void refresh();};
    document.addEventListener("visibilitychange",check);
    return ()=>document.removeEventListener("visibilitychange",check);
  },[state?.actor,refresh]);
  if(state && (!state.enabled || state.actor))return <>
    {error && <p role="alert" className="bg-red-50 p-3 text-center text-red-900">{error}</p>}
    {children(state.actor,{finish,switchUser,refresh})}
  </>;
  return <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-blue-800">Berlindo · Laporan Harian Kerja</p>
      <h1 className="mt-2 mb-5 text-2xl font-bold">Masuk operator</h1>
      {message && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-green-900">{message}</p>}
      {error && <p role="alert" className="mb-4 text-red-800">{error}</p>}
      {state ? <form onSubmit={async e=>{
        e.preventDefault();if(busy)return;setBusy(true);setError("");setMessage("");
        try {
          const res=await fetch("/api/operator-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"login",nik})});
          const data=await res.json();
          if(!res.ok){await refresh();throw Error(data.error||"Gagal masuk.");}
          setNik("");setState({enabled:true,actor:data.actor});
        }catch(err){setError(err instanceof Error?err.message:"Periksa koneksi.");}
        finally{setBusy(false);}
      }}>
        <label className="block font-semibold" htmlFor="nik">NIK kerja</label>
        <input id="nik" type="text" autoComplete="off" spellCheck={false} placeholder="DDMMYY-NN" value={nik} onChange={e=>setNik(e.target.value)} required maxLength={12}
          className="mt-2 w-full rounded-xl border border-slate-400 p-3" />
        <button disabled={busy} className="mt-4 min-h-12 w-full rounded-xl bg-blue-800 p-3 font-bold text-white">{busy?"Memeriksa…":"Masuk ke form"}</button>
      </form> : error ? <button onClick={refresh} className="rounded-xl border px-4 py-3 font-semibold">Coba lagi</button> : <p>Memuat form…</p>}
    </section></main>;
}
