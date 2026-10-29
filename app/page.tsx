"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Restore the durable browser outbox after hydration and report storage failures. */

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import MAPPING_FORM from "../constants/formMapping.json";

import { initialForm, resetForContext, validateSubmission } from "@/lib/lkh";
import type { Master, Submission, Receipt } from "@/lib/lkh";

const SNAPSHOT = MAPPING_FORM as Master;
const DRAFT_KEY = "berlindo-lkh-draft-v2";
const PENDING_KEY = "berlindo-lkh-pending-v2";
const RECEIPT_KEY = "berlindo-lkh-receipt-v2";

// HELPERS
// ============================================================
const toMinutes = (t: string): number | null => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const formatDuration = (start: string, end: string): string | null => {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null) return null;
  let diff = e - s;
  if (diff < 0) diff += 1440; // lewat tengah malam
  const hh = Math.floor(diff / 60);
  const mm = diff % 60;
  return `${hh}j ${mm}m`;
};

export default function LaporanKerjaForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lineSelected, setLineSelected] = useState<string>("LINE_1");
  const [formData, setFormData] = useState(initialForm);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [mapping, setMapping] = useState<Master>(SNAPSHOT);
  const [connection, setConnection] = useState<{ready: boolean; mode: string; source: string}>({ready: false, mode: "test", source: "loading"});
  const [pending, setPending] = useState<Submission | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    fetch("/api/master", {cache: "no-store"}).then(r => r.json()).then(result => {
      if (!result.mapping || !Object.keys(result.mapping).length) throw Error();
      setMapping(result.mapping);
      setConnection({ready: result.ready === true, mode: result.mode, source: result.source});
    }).catch(() => setConnection({ready: false, mode: "test", source: "offline"}));
    try {
      const savedPending = localStorage.getItem(PENDING_KEY);
      if (savedPending) {
        const p = JSON.parse(savedPending) as Submission;
        if (!p.id || !p.form || !SNAPSHOT[p.line]) throw Error();
        setPending(p); setLineSelected(p.line); setFormData(p.form);
      }
      setDraftAvailable(Boolean(localStorage.getItem(DRAFT_KEY)));
      const last = localStorage.getItem(RECEIPT_KEY);
      if (last) setReceipt(JSON.parse(last));
    } catch { setStorageAvailable(false); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || pending) return;
    try {
      if (formData.tanggal || formData.mesin || formData.operator.length) localStorage.setItem(DRAFT_KEY, JSON.stringify({line: lineSelected, form: formData}));
    } catch { setStorageAvailable(false); }
  }, [formData, lineSelected, hydrated, pending]);

  const restoreDraft = () => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (draft && mapping[draft.line] && draft.form) { setLineSelected(draft.line); setFormData({...initialForm, ...draft.form}); }
      setDraftAvailable(false);
    } catch { setToast({type: "error", msg: "Draft tidak dapat dibuka. Periksa penyimpanan browser."}); }
  };

  // --- Config aktif ---
  const currentConfig = mapping[lineSelected];
  const listMesin = useMemo(
    () => Object.keys(currentConfig?.mesin_part_mapping || {}),
    [currentConfig]
  );
  const listOperator = currentConfig?.operators || [];
  const selectedMesinData = currentConfig?.mesin_part_mapping?.[formData.mesin];
  const listPart = selectedMesinData?.options || [];

  // --- Flag Line 8 & percabangan aktivitas ---
  const isLine8 = lineSelected === "LINE_8";
  const showProduction = !isLine8 || formData.jenisAktivitas === "PRODUKSI";
  const showDandori = isLine8 && formData.jenisAktivitas === "DANDORI";

  // --- Durasi (live) ---
  const durasiProses = formatDuration(formData.jamMulaiProses, formData.jamSelesaiProses);
  const durasiKendala = formatDuration(formData.jamMulaiKendala, formData.jamSelesaiKendala);

  const kendala4MOptions = isLine8
    ? ["MANUSIA", "MESIN", "MATERIAL", "METODE", "DANDORY"]
    : ["MANUSIA", "MESIN", "MATERIAL", "METODE"];

  // --- Handlers ---
  const handleLineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLineSelected(e.target.value);
    setFormData((prev) => resetForContext(prev));
    setDraftAvailable(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "mesin" ? { ...resetForContext(prev), mesin: value, operator: prev.operator, operatorLainnya: prev.operatorLainnya } : {}),
      ...(["qtyRepair", "qtyReject"].includes(name) && Number(value) > 0 ? { kendala: "Ada" } : {}),
    }));
  };

  const setField = (name: string, value: string) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const handleOperatorToggle = (op: string) => {
    setFormData((prev) => {
      const ops = prev.operator;
      return ops.includes(op)
        ? { ...prev, operator: ops.filter((o) => o !== op) }
        : { ...prev, operator: [...ops, op] };
    });
  };

  // ============================================================
  // SUBMIT
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || !connection.ready || !storageAvailable) return;
    const payload: Submission = pending || {id: "LKH-" + crypto.randomUUID(), line: lineSelected, form: formData};
    const errors = pending ? [] : validateSubmission(payload, mapping);
    if (errors.length) { setToast({type: "error", msg: errors.join(" ")}); window.scrollTo({top: 0, behavior: "smooth"}); return; }
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(payload)); }
    catch { setStorageAvailable(false); setToast({type: "error", msg: "Aktifkan penyimpanan browser sebelum mengirim agar ID laporan aman saat koneksi terputus."}); return; }
    inFlight.current = true; setIsSubmitting(true); setPending(payload); setToast(null);
    try {
      const response = await fetch("/api/submissions", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload), signal: AbortSignal.timeout(80000) });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.receipt?.id !== payload.id) {
        if (response.status >= 400 && response.status < 500) { localStorage.removeItem(PENDING_KEY); setPending(null); }
        throw Error(result.error || "Penerimaan belum dapat dikonfirmasi.");
      }
      // Persist the receipt before clearing the pending ID or the input.
      localStorage.setItem(RECEIPT_KEY, JSON.stringify(result.receipt));
      localStorage.removeItem(PENDING_KEY); localStorage.removeItem(DRAFT_KEY);
      setReceipt(result.receipt); setPending(null); setFormData(initialForm); setDraftAvailable(false);
      setToast({type: "success", msg: result.receipt.mode === "test" ? "Data uji tersimpan di tempat pengujian." : "Laporan tersimpan dan masuk antrean. Belum berarti terbit di TF Slip."});
      window.scrollTo({top: 0, behavior: "smooth"});
    } catch (error) {
      setToast({type: "error", msg: error instanceof Error ? error.message : "Belum ada konfirmasi. Coba ulang dengan ID laporan yang sama."});
    } finally { inFlight.current = false; setIsSubmitting(false); }
  };

  // --- Progress step ---
  const step1Done = !!(formData.tanggal && formData.shift && formData.mesin && formData.operator.length);
  const step2Done = isLine8 ? !!(formData.part && formData.jenisAktivitas) : !!formData.part;
  const step3Done = showDandori
    ? !!(formData.tanggalMulaiDandori && formData.jamMulaiDandori && formData.tanggalSelesaiDandori &&
        formData.jamSelesaiDandori && formData.tahapDandori && formData.hasilDandori && formData.catatanDandori)
    : !!(formData.jamMulaiProses && formData.jamSelesaiProses && formData.qtyOk !== "" &&
        formData.lembur && formData.kendala);

  // Label & helper qty menyesuaikan Line 8
  const qtyFields = [
    {
      name: "qtyOk",
      label: isLine8 ? "Qty OK (Batang)" : "Qty OK",
      value: formData.qtyOk,
      color: "green",
      helper: isLine8 ? "Satuan: Batang" : null,
    },
    {
      name: "qtyRepair",
      label: isLine8 ? "Repair (mm)" : "Repair",
      value: formData.qtyRepair,
      color: "orange",
      helper: isLine8 ? "Satuan: mm (ukur dengan meteran)" : null,
    },
    {
      name: "qtyReject",
      label: isLine8 ? "Reject (mm)" : "Reject",
      value: formData.qtyReject,
      color: "red",
      helper: isLine8 ? "Satuan: mm (ukur dengan meteran)" : null,
    },
  ] as const;

  const colorMap: Record<string, string> = {
    green: "text-green-700 focus:ring-green-500 bg-green-50",
    orange: "text-orange-600 focus:ring-orange-500 bg-orange-50",
    red: "text-red-700 focus:ring-red-500 bg-red-50",
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-28">
      {/* TOAST */}
      {toast && (
        <div className="relative z-[60] mx-auto pt-4 w-[92%] max-w-4xl">
          <div role="status" aria-live="polite"
            className={`rounded-xl px-4 py-3 shadow-lg border text-sm font-semibold ${
              toast.type === "success"
                ? "bg-green-600 text-white border-green-700"
                : "bg-red-600 text-white border-red-700"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 h-56 w-full absolute top-0 z-0 rounded-b-[2.5rem] shadow-xl"></div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-10">
        <div className="text-center mb-6 flex flex-col items-center justify-center">
          <div className="bg-white px-6 py-3 rounded-2xl shadow-md mb-4 inline-flex items-center justify-center border border-gray-100">
            <Image width={240} height={64} unoptimized
              src="/logo-berlindo.png"
              alt="Logo PT Berlindo Mitra Utama"
              className="h-10 md:h-12 w-auto object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
            Laporan Harian Kerja
          </h1>
          <p className="text-blue-100 mt-2 font-medium tracking-wide">Production System — Berlindo</p>
        </div>

        {/* STEP INDICATOR */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { n: 1, done: step1Done },
            { n: 2, done: step2Done },
            { n: 3, done: step3Done },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s.done ? "bg-green-400 text-green-900" : "bg-white/30 text-white border border-white/40"
                }`}
              >
                {s.done ? "✓" : s.n}
              </div>
              {i < 2 && <div className="w-8 h-0.5 bg-white/30 mx-1" />}
            </div>
          ))}
        </div>

        <div className="bg-white border border-blue-200 rounded-2xl p-5 mb-6 text-slate-800 space-y-3" role="status">
          <p className="font-bold">{connection.mode === "production" ? "Laporan operasional" : "Versi pengujian • tidak masuk TF Slip produksi"}</p>
          <p className="text-sm">{connection.ready ? "Master terhubung. Pengiriman menunggu konfirmasi penyimpanan." : connection.source === "loading" ? "Memeriksa koneksi penerima…" : "Penerima belum siap. Kamu bisa mencoba isian; pengiriman dinonaktifkan."}</p>
          {connection.source !== "live" && <p className="text-sm text-amber-800">Dropdown menggunakan salinan master. Sinkronisasi langsung tersedia setelah penerima dihubungkan.</p>}
          {!storageAvailable && <p className="text-sm text-red-700">Penyimpanan browser tidak tersedia. Aktifkan sebelum mengirim laporan.</p>}
          {draftAvailable && !pending && <button type="button" onClick={restoreDraft} className="font-bold text-blue-800 underline">Pulihkan draft sebelumnya</button>}
          {pending && <p className="text-sm text-amber-900">Menunggu konfirmasi: <strong>{pending.id}</strong>. Isian dikunci agar kirim ulang memakai laporan yang sama. Gunakan tombol Coba Kirim Ulang di bawah.</p>}
          {receipt && <p className="text-sm break-all">Bukti penerimaan terakhir: <strong>{receipt.id}</strong> — {receipt.state === "TEST_SAVED" ? "DATA UJI TERSIMPAN" : "TERSIMPAN / MASUK ANTREAN, BELUM KONFIRMASI TF SLIP"}</p>}
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset disabled={isSubmitting || !!pending} className="space-y-6 disabled:opacity-70">
          {/* SECTION 1 */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3 border-b pb-3">
              <span className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">1</span>
              Informasi Dasar
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LINE */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Pilih Line Produksi <span className="text-red-500">*</span>
                </label>
                <select
                  aria-label="Line produksi" value={lineSelected}
                  onChange={handleLineChange}
                  className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50 text-blue-900 font-bold shadow-sm"
                >
                  {Object.keys(mapping).map((l) => (
                    <option key={l} value={l}>{l.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              {/* TANGGAL */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Tanggal Laporan <span className="text-red-500">*</span>
                </label>
                <input type="date" name="tanggal" required value={formData.tanggal} onChange={handleChange} aria-label="Tanggal laporan"
                  className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white text-gray-900 shadow-sm" />
              </div>

              {/* SHIFT */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Shift <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {["1", "2"].map((s) => (
                    <label key={s} className="relative cursor-pointer">
                      <input type="radio" name="shift" value={s} required onChange={handleChange} checked={formData.shift === s} className="peer sr-only" />
                      <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center peer-checked:bg-orange-500 peer-checked:text-white peer-checked:border-orange-500 hover:border-orange-300 transition-all font-semibold shadow-sm">
                        Shift {s}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* MESIN */}
              <div className="space-y-2 md:col-span-2 mt-2">
                <label className="text-sm font-semibold text-gray-700">Pilih Mesin <span className="text-red-500">*</span></label>
                {listMesin.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {listMesin.map((m) => (
                      <label key={m} className="relative cursor-pointer">
                        <input type="radio" name="mesin" value={m} required onChange={handleChange} checked={formData.mesin === m} className="peer sr-only" />
                        <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center text-xs md:text-sm peer-checked:bg-orange-500 peer-checked:text-white peer-checked:border-orange-500 hover:border-orange-300 transition-all font-semibold flex items-center justify-center h-full shadow-sm min-h-[3rem]">
                          {m}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Mesin belum tersedia untuk Line ini.</p>
                )}
              </div>

              {/* OPERATOR */}
              <div className="space-y-2 md:col-span-2 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">Nama Operator <span className="text-red-500">*</span></label>
                  {formData.operator.length > 0 && (
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                      {formData.operator.length} dipilih
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {listOperator.map((op) => (
                    <label key={op} className="relative cursor-pointer">
                      <input type="checkbox" name="operator" value={op} onChange={() => handleOperatorToggle(op)} checked={formData.operator.includes(op)} className="peer sr-only" />
                      <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center text-sm peer-checked:bg-blue-50 peer-checked:text-blue-800 peer-checked:border-blue-500 hover:border-blue-300 transition-all font-semibold shadow-sm min-h-[3rem] flex items-center justify-center">
                        {op === "__other_option__" ? "Lainnya" : op}
                      </div>
                    </label>
                  ))}
                </div>
                <div className={`grid transition-[grid-template-rows] duration-300 ${formData.operator.includes("__other_option__") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <input type="text" name="operatorLainnya" placeholder="Ketik nama operator manual..."
                      required={formData.operator.includes("__other_option__")} value={formData.operatorLainnya} onChange={handleChange}
                      className="w-full mt-3 border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 shadow-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: PART */}
          <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${formData.mesin ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 md:p-8 mt-2">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-3 border-b pb-3">
                  <span className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">2</span>
                  Detail Part <span className="text-orange-600 ml-1">({formData.mesin})</span>
                </h2>

                {listPart.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {listPart.map((partName) => (
                      <label key={partName} className="relative cursor-pointer group">
                        <input type="radio" name="part" value={partName} required onChange={handleChange} checked={formData.part === partName} className="peer sr-only" />
                        <div className="p-4 border-2 border-gray-200 bg-white rounded-xl peer-checked:border-orange-500 peer-checked:bg-orange-50 hover:border-orange-300 transition-all flex items-center justify-between shadow-sm">
                          <span className="font-semibold text-gray-800 peer-checked:text-orange-800">{partName}</span>
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 peer-checked:border-orange-600 flex items-center justify-center transition-all bg-white shrink-0 ml-3">
                            <div className={`w-2 h-2 rounded-full bg-orange-600 transition-opacity ${formData.part === partName ? "opacity-100" : "opacity-0"}`}></div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic mt-2">Daftar Part belum tersedia untuk mesin ini.</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION LINE 8: JENIS AKTIVITAS */}
          {isLine8 && (
            <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${formData.part ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="bg-indigo-50 rounded-2xl shadow-md border border-indigo-200 p-6 md:p-8 mt-2">
                  <h2 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-3">
                    <span className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">★</span>
                    Jenis Aktivitas <span className="text-red-500">*</span>
                  </h2>
                  <p className="text-xs text-indigo-700 mb-4">
                    Pilih satu aktivitas per laporan. Jika dalam satu shift ada dandori & produksi, buat dua laporan dengan waktu tidak tumpang tindih.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {["PRODUKSI", "DANDORI"].map((j) => (
                      <label key={j} className="relative cursor-pointer">
                        <input type="radio" name="jenisAktivitas" value={j} required={isLine8} onChange={(e) => setFormData(prev => ({...resetForContext(prev), mesin: prev.mesin, part: prev.part, operator: prev.operator, operatorLainnya: prev.operatorLainnya, jenisAktivitas: e.target.value}))} checked={formData.jenisAktivitas === j} className="peer sr-only" />
                        <div className="p-4 border-2 border-indigo-200 bg-white text-indigo-900 rounded-xl text-center peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600 hover:border-indigo-400 transition-all font-bold shadow-sm">
                          {j}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: HASIL PRODUKSI (Line 1-7 selalu; Line 8 hanya jika PRODUKSI) */}
          {showProduction && (!isLine8 || formData.jenisAktivitas === "PRODUKSI") && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 md:p-8">
              <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3 border-b pb-3">
                <span className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">3</span>
                Hasil Produksi
              </h2>
              <p className="text-sm text-slate-600 mb-4">Tanggal laporan mengikuti tanggal mulai shift. Untuk shift 2, jam setelah tengah malam dihitung pada hari berikutnya. Isi jam selesai yang sudah berlangsung.</p>

              <div className="grid grid-cols-2 gap-6 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Jam Mulai <span className="text-red-500">*</span></label>
                  <input type="time" name="jamMulaiProses" aria-label="Jam mulai proses" required={showProduction} value={formData.jamMulaiProses} onChange={handleChange}
                    className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 shadow-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Jam Selesai <span className="text-red-500">*</span></label>
                  <input type="time" name="jamSelesaiProses" aria-label="Jam selesai proses" required={showProduction} value={formData.jamSelesaiProses} onChange={handleChange}
                    className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 shadow-sm" />
                </div>
              </div>
              {durasiProses && (
                <p className="text-xs font-semibold text-blue-700 bg-blue-50 inline-block px-3 py-1 rounded-full mb-6">
                  ⏱️ Durasi proses: {durasiProses}
                </p>
              )}

              <div className="grid grid-cols-3 gap-4 mb-2">
                {qtyFields.map((f) => (
                  <div key={f.name} className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">{f.label} <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      inputMode={isLine8 ? "decimal" : "numeric"}
                      step={isLine8 ? "any" : undefined}
                      min="0"
                      aria-label={f.label} name={f.name}
                      required={showProduction}
                      value={f.value}
                      onChange={handleChange}
                      className={`w-full border-gray-300 border p-3 rounded-xl text-center text-lg font-bold outline-none focus:ring-2 shadow-sm ${colorMap[f.color]}`}
                    />
                    {f.helper && <p className="text-[10px] text-gray-500 italic text-center leading-tight">{f.helper}</p>}
                    {(f.name === "qtyRepair" || f.name === "qtyReject") && (
                      <p className="text-[10px] md:text-xs text-red-500 italic text-center leading-tight">
                        *Apabila ada, pilih opsi &quot;Ada Kendala&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* JUMLAH SAMBUNGAN (Line 8, opsional) */}
              {isLine8 && (
                <div className="space-y-2 mt-4 mb-2">
                  <label className="text-sm font-semibold text-gray-700">Jumlah Sambungan</label>
                  <div className="flex flex-wrap gap-2">
                    {["0", "1", "2", "3", "__other_option__"].map((v) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => setField("jumlahSambungan", formData.jumlahSambungan === v ? "" : v)}
                        className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all shadow-sm ${
                          formData.jumlahSambungan === v
                            ? "bg-blue-800 text-white border-blue-800"
                            : "bg-white text-gray-800 border-gray-300 hover:border-blue-300"
                        }`}
                      >
                        {v === "__other_option__" ? "Lainnya" : v}
                      </button>
                    ))}
                  </div>
                  {formData.jumlahSambungan === "__other_option__" && (
                    <input type="text" name="jumlahSambunganLainnya" placeholder="Jumlah sambungan..." value={formData.jumlahSambunganLainnya} onChange={handleChange}
                      className="w-full mt-2 border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 shadow-sm" />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 mt-2 border-t border-gray-100">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Apakah ada lembur? <span className="text-red-500">*</span></label>
                  <div className="flex gap-3">
                    {["Yes", "No"].map((opt) => (
                      <label key={opt} className="relative cursor-pointer flex-1">
                        <input type="radio" name="lembur" value={opt} required={showProduction} onChange={handleChange} checked={formData.lembur === opt} className="peer sr-only" />
                        <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center peer-checked:bg-blue-800 peer-checked:text-white peer-checked:border-blue-800 transition-all font-semibold shadow-sm">
                          {opt}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Status Kendala <span className="text-red-500">*</span></label>
                  <div className="flex gap-3">
                    <label className="relative cursor-pointer flex-1">
                      <input type="radio" name="kendala" value="Tidak" required={showProduction} onChange={handleChange} checked={formData.kendala === "Tidak"} className="peer sr-only" />
                      <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center peer-checked:bg-green-600 peer-checked:border-green-600 peer-checked:text-white transition-all font-semibold shadow-sm">
                        Aman
                      </div>
                    </label>
                    <label className="relative cursor-pointer flex-1">
                      <input type="radio" name="kendala" value="Ada" required={showProduction} onChange={handleChange} checked={formData.kendala === "Ada"} className="peer sr-only" />
                      <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center peer-checked:bg-red-600 peer-checked:border-red-600 peer-checked:text-white transition-all font-semibold shadow-sm">
                        Ada Kendala
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: DETAIL KENDALA */}
          {showProduction && (
            <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${formData.kendala === "Ada" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="bg-red-50 rounded-2xl shadow-md border border-red-200 p-6 md:p-8 mt-2">
                  <h2 className="text-lg font-bold text-red-800 mb-6 flex items-center gap-3 border-b border-red-200 pb-3">
                    <span className="bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">!</span>
                    Detail Kendala
                  </h2>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-800">Kendala 4M <span className="text-red-500">*</span></label>
                      <select name="kendala4M" required={formData.kendala === "Ada"} value={formData.kendala4M} onChange={handleChange}
                        className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 shadow-sm">
                        <option value="" disabled>-- Pilih Klasifikasi --</option>
                        {kendala4MOptions.map((opt, i) => (
                          <option key={opt} value={opt}>{i + 1}. {opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-800">Permasalahan <span className="text-red-500">*</span></label>
                      <textarea name="permasalahan" rows={2} required={formData.kendala === "Ada"} value={formData.permasalahan} onChange={handleChange}
                        placeholder="Deskripsikan masalah yang terjadi..." className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 placeholder-gray-400 shadow-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-800">Tindakan <span className="text-red-500">*</span></label>
                      <textarea name="tindakan" rows={2} required={formData.kendala === "Ada"} value={formData.tindakan} onChange={handleChange}
                        placeholder="Langkah perbaikan yang dilakukan..." className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 placeholder-gray-400 shadow-sm" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-800">PIC <span className="text-red-500">*</span></label>
                        <input type="text" name="pic" required={formData.kendala === "Ada"} value={formData.pic} onChange={handleChange}
                          placeholder="Nama PIC..." className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 shadow-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-800">Mulai Kendala <span className="text-red-500">*</span></label>
                        <input type="time" name="jamMulaiKendala" required={formData.kendala === "Ada"} value={formData.jamMulaiKendala} onChange={handleChange}
                          className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 shadow-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-800">Selesai Kendala <span className="text-red-500">*</span></label>
                        <input type="time" name="jamSelesaiKendala" required={formData.kendala === "Ada"} value={formData.jamSelesaiKendala} onChange={handleChange}
                          className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 shadow-sm" />
                      </div>
                    </div>
                    {durasiKendala && (
                      <p className="text-xs font-semibold text-red-700 bg-red-100 inline-block px-3 py-1 rounded-full">
                        ⏱️ Lama downtime: {durasiKendala}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION DANDORI (khusus Line 8) */}
          {showDandori && (
            <div className="bg-purple-50 rounded-2xl shadow-md border border-purple-200 p-6 md:p-8">
              <h2 className="text-lg font-bold text-purple-900 mb-2 flex items-center gap-3 border-b border-purple-200 pb-3">
                <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">D</span>
                Laporan Dandori
              </h2>
              <p className="text-xs text-purple-700 mb-5">
                Tidak perlu mengisi qty. Catat pekerjaan pada shift ini saja. Jika belum selesai, shift berikutnya membuat laporan lanjutan dengan part tujuan yang sama.
              </p>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Tanggal Mulai Dandori <span className="text-red-500">*</span></label>
                    <input type="date" name="tanggalMulaiDandori" required={showDandori} value={formData.tanggalMulaiDandori} onChange={handleChange}
                      className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white text-gray-900 shadow-sm" />
                    <p className="text-[10px] text-gray-500 italic">Tanggal aktual (WIB). Setelah tengah malam gunakan tanggal berikutnya.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Jam Mulai Dandori <span className="text-red-500">*</span></label>
                    <input type="time" name="jamMulaiDandori" required={showDandori} value={formData.jamMulaiDandori} onChange={handleChange}
                      className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white text-gray-900 shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Tanggal Selesai Dandori <span className="text-red-500">*</span></label>
                    <input type="date" name="tanggalSelesaiDandori" required={showDandori} value={formData.tanggalSelesaiDandori} onChange={handleChange}
                      className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white text-gray-900 shadow-sm" />
                    <p className="text-[10px] text-gray-500 italic">Tanggal aktual (WIB). Setelah tengah malam gunakan tanggal berikutnya.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Jam Selesai Dandori <span className="text-red-500">*</span></label>
                    <input type="time" name="jamSelesaiDandori" required={showDandori} value={formData.jamSelesaiDandori} onChange={handleChange}
                      className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white text-gray-900 shadow-sm" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Tahap Dandori <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {["MULAI BARU", "LANJUTAN SHIFT SEBELUMNYA"].map((t) => (
                      <label key={t} className="relative cursor-pointer">
                        <input type="radio" name="tahapDandori" value={t} required={showDandori} onChange={handleChange} checked={formData.tahapDandori === t} className="peer sr-only" />
                        <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center text-sm peer-checked:bg-purple-600 peer-checked:text-white peer-checked:border-purple-600 transition-all font-semibold shadow-sm">
                          {t}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Hasil Dandori <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-1 gap-3">
                    {["SELESAI - SIAP PRODUKSI", "BELUM SELESAI - LANJUT SHIFT BERIKUTNYA"].map((h) => (
                      <label key={h} className="relative cursor-pointer">
                        <input type="radio" name="hasilDandori" value={h} required={showDandori} onChange={handleChange} checked={formData.hasilDandori === h} className="peer sr-only" />
                        <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center text-sm peer-checked:bg-purple-600 peer-checked:text-white peer-checked:border-purple-600 transition-all font-semibold shadow-sm">
                          {h}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Catatan Dandori <span className="text-red-500">*</span></label>
                  <textarea name="catatanDandori" rows={2} required={showDandori} value={formData.catatanDandori} onChange={handleChange}
                    placeholder="Tuliskan pekerjaan yang selesai, kendala, serta pekerjaan tersisa bila perlu dilanjutkan." className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white text-gray-900 placeholder-gray-400 shadow-sm" />
                </div>
              </div>
            </div>
          )}

          </fieldset>
          {/* STICKY SUBMIT */}
          <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="hidden sm:block text-xs text-gray-500 leading-tight">
                <span className="font-bold text-blue-800">{lineSelected.replace("_", " ")}</span>
                {isLine8 && formData.jenisAktivitas && <> • {formData.jenisAktivitas}</>}
                {formData.operator.length > 0 && <> • {formData.operator.length} operator</>}
              </div>
              <button type="submit" disabled={isSubmitting || !connection.ready || !storageAvailable}
                className="w-full sm:w-auto px-10 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-extrabold text-lg shadow-lg shadow-orange-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                {isSubmitting ? "Mengirim Data..." : (pending ? "Coba Kirim Ulang" : connection.mode === "test" ? "Kirim Data Uji" : "Kirim Laporan")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
