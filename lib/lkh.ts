export type MachineConfig = { options: string[]; categories?: Record<string, string>; entryId?: string; page?: number };
export type LineConfig = { operators: string[]; mesin_part_mapping: Record<string, MachineConfig> };
export type Master = Record<string, LineConfig>;
export const initialForm = {
  tanggal: "", shift: "", operator: [] as string[], operatorLainnya: "", mesin: "", part: "",
  jamMulaiProses: "", jamSelesaiProses: "", qtyOk: "", qtyRepair: "", qtyReject: "",
  lembur: "", kendala: "Tidak", jenisAktivitas: "", jumlahSambungan: "", jumlahSambunganLainnya: "",
  kendala4M: "", permasalahan: "", tindakan: "", pic: "", jamMulaiKendala: "", jamSelesaiKendala: "",
  tanggalMulaiDandori: "", jamMulaiDandori: "", tanggalSelesaiDandori: "", jamSelesaiDandori: "",
  tahapDandori: "", hasilDandori: "", catatanDandori: "",
};
export type LkhForm = typeof initialForm;
export type Submission = { id: string; line: string; form: LkhForm };
export type Receipt = { id: string; state: "TEST_SAVED" | "QUEUED"; mode: "test" | "production"; receivedAt: string };

export function resetForContext(form: LkhForm): LkhForm {
  return { ...initialForm, tanggal: form.tanggal, shift: form.shift };
}
export function minutes(time: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T00:00:00Z");
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === date;
}
export function processInterval(form: LkhForm): { start: number; end: number } | null {
  if (!validDate(form.tanggal)) return null;
  const s = minutes(form.jamMulaiProses), e = minutes(form.jamSelesaiProses);
  if (s === null || e === null || !["1", "2"].includes(form.shift)) return null;
  const day = Date.parse(form.tanggal + "T00:00:00+07:00");
  // For shift 2, post-midnight hours belong to the following calendar day.
  const start = day + (s + (form.shift === "2" && s < 720 ? 1440 : 0)) * 60000;
  let end = day + (e + (form.shift === "2" && e < 720 ? 1440 : 0)) * 60000;
  if (end < start && form.shift === "2") end += 86400000;
  return { start, end };
}
export function validateSubmission(value: unknown, master: Master, now = Date.now()): string[] {
  if (!value || typeof value !== "object") return ["Format laporan tidak valid."];
  const p = value as Submission;
  if (typeof p.id !== "string" || !/^LKH-[0-9a-f-]{36}$/i.test(p.id)) return ["ID laporan tidak valid."];
  const c = Object.hasOwn(master, p.line) ? master[p.line] : undefined;
  if (!c || !p.form || typeof p.form !== "object") return ["Line laporan tidak valid."];
  const f = p.form;
  const badShape = Object.keys(initialForm).some(k => k === "operator"
    ? !Array.isArray(f.operator) || f.operator.some(v => typeof v !== "string")
    : typeof f[k as keyof LkhForm] !== "string" || String(f[k as keyof LkhForm]).length > 3000);
  if (badShape) return ["Isian laporan tidak valid atau terlalu panjang."];
  const errors: string[] = [];
  if (!validDate(f.tanggal)) errors.push("Tanggal laporan tidak valid.");
  else if (Date.parse(f.tanggal + "T00:00:00+07:00") > now) errors.push("Tanggal laporan belum berlangsung.");
  if (!["1", "2"].includes(f.shift)) errors.push("Pilih shift secara eksplisit.");
  const machine = c.mesin_part_mapping[f.mesin];
  if (!machine) errors.push("Pilih mesin yang aktif pada line ini.");
  if (!machine?.options.includes(f.part)) errors.push("Pilih part yang aktif pada mesin ini.");
  if (!f.operator.length || new Set(f.operator).size !== f.operator.length || f.operator.some(o => !c.operators.includes(o))) errors.push("Pilih operator yang valid.");
  if (f.operator.includes("__other_option__")) {
    const manual = f.operatorLainnya.trim().replace(/\s+/g, " ");
    if (!manual || manual.length > 100 || /[,;\r\n\x00-\x1f]/.test(f.operatorLainnya)) errors.push("Isi satu nama operator lainnya, maksimal 100 karakter.");
    if (f.operator.some(o => o !== "__other_option__" && o.trim().replace(/\s+/g, " ").toLowerCase() === manual.toLowerCase())) errors.push("Operator yang sama tidak boleh dipilih dua kali.");
  }
  if (p.line === "LINE_8" && !["PRODUKSI", "DANDORI"].includes(f.jenisAktivitas)) errors.push("Pilih jenis aktivitas Line 8.");
  const dandori = p.line === "LINE_8" && f.jenisAktivitas === "DANDORI";
  if (dandori) {
    if (!validDate(f.tanggalMulaiDandori) || !validDate(f.tanggalSelesaiDandori) || minutes(f.jamMulaiDandori) === null || minutes(f.jamSelesaiDandori) === null) errors.push("Lengkapi tanggal dan jam dandori.");
    else {
      const start = Date.parse(f.tanggalMulaiDandori + "T" + f.jamMulaiDandori + ":00+07:00");
      const end = Date.parse(f.tanggalSelesaiDandori + "T" + f.jamSelesaiDandori + ":00+07:00");
      if (end <= start || end > now + 300000) errors.push("Waktu dandori harus berurutan dan sudah berlangsung.");
    }
    if (!["MULAI BARU", "LANJUTAN SHIFT SEBELUMNYA"].includes(f.tahapDandori) || !["SELESAI - SIAP PRODUKSI", "BELUM SELESAI - LANJUT SHIFT BERIKUTNYA"].includes(f.hasilDandori) || !f.catatanDandori.trim()) errors.push("Lengkapi tahap dan hasil dandori.");
  } else {
    const interval = processInterval(f);
    if (!interval || interval.end <= interval.start || interval.end - interval.start > 16 * 3600000) errors.push("Periksa jam proses: durasi harus lebih dari 0 dan maksimal 16 jam.");
    else if (interval.end > now + 300000) errors.push("Jam selesai belum berlangsung. Periksa tanggal produksi dan shift.");
    for (const k of ["qtyOk", "qtyRepair", "qtyReject"] as const) {
      if (!/^\d+(\.\d+)?$/.test(f[k]) || !Number.isFinite(Number(f[k])) || (p.line !== "LINE_8" && !Number.isSafeInteger(Number(f[k]))) || Number(f[k]) > 100000000) errors.push("Qty harus berupa angka nonnegatif dengan satuan yang sesuai.");
    }
    if (!["Yes", "No"].includes(f.lembur)) errors.push("Pilih status lembur.");
    if (!["Ada", "Tidak"].includes(f.kendala)) errors.push("Pilih status kendala.");
    if ((Number(f.qtyRepair) > 0 || Number(f.qtyReject) > 0) && f.kendala !== "Ada") errors.push("Repair/reject lebih dari 0: pilih Ada Kendala dan lengkapi penjelasan.");
    if (f.kendala === "Ada") {
      if (!["MANUSIA", "MESIN", "MATERIAL", "METODE", ...(p.line === "LINE_8" ? ["DANDORY"] : [])].includes(f.kendala4M) || !f.permasalahan.trim() || !f.tindakan.trim() || !f.pic.trim()) errors.push("Lengkapi klasifikasi dan detail kendala.");
      const s = minutes(f.jamMulaiKendala), e = minutes(f.jamSelesaiKendala);
      if (s === null || e === null || s === e) errors.push("Lengkapi jam kendala dengan durasi lebih dari 0.");
      else if (interval) {
        let start = Math.floor(interval.start / 86400000) * 86400000 + ((s - 420 + 1440) % 1440) * 60000;
        while (start < interval.start) start += 86400000;
        const end = start + ((e - s + 1440) % 1440) * 60000;
        if (start < interval.start || end > interval.end) errors.push("Waktu kendala harus berada dalam waktu proses.");
      }
    }
    if (p.line === "LINE_8" && f.jumlahSambungan === "__other_option__" && !/^\d+$/.test(f.jumlahSambunganLainnya)) errors.push("Isi jumlah sambungan lainnya dengan angka bulat nonnegatif.");
  }
  return [...new Set(errors)];
}
