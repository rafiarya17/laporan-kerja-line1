"use client";

import { useState } from "react";

// --- DATA REFERENSI ---
const OPERATOR_LIST = [
  "Nanang Sunaryo", "Edwin Hardianto", "Arif nurhadi", "Hanif Mustofa",
  "Sarmita", "Bayu Aji Prakoso", "Kamung Suryana", "Agus Susanto",
  "Asep Rudiyono", "Abdul Rohman", "Lainnya"
];

const MESIN_LIST = [
  "4X8 SILINCER", "ARGON BJM", "AUTO CHAMPER", "MANUAL CHAMPER",
  "SPM MIG TK TR", "PRESS 110 T", "PRESS 45 TON", "ROLL SAKTI"
];

const PART_MAPPING: Record<string, string[]> = {
  "4X8 SILINCER": ["4X8 SILINCER_4X8-E4753-0000-0310"],
  "ARGON BJM": ["BODY 2-1_BJM-E472A-00-P3"],
  "AUTO CHAMPER": ["PIPE 1_BPA-E4742-0000-0335", "PIPE 1_BLS-E475A-0000-0305", "PIPE 1_DB2-E4741-0000-0635"],
  "MANUAL CHAMPER": ["PIPE BOARD_SCP-45060-0000-0305"],
  "SPM MIG TK TR": ["AUX TK_EJAPROD-SUBACM002", "AUX TR_EJAPROD-SUBACM001"],
  "PRESS 110 T": ["PIPE 1_B6H-E475A-0000-0305", "BODY 1-3_BSS-E471F-0000-0305", "BODY 1-1_BK6-E471A-0000-0905", "PIPE 1-1_B65-E461H-0000-0305", "PIPE 7_BJM-475K-00", "DIFFUSER CP_B0P-E4785-0100-0305-P4", "PIPE 9_2PV-E475M-0100-S0305"],
  "PRESS 45 TON": ["DIFFUSER CP_B0P-E4785-0100-0305-P4", "PIPE 9_2PV-E475M-0100-S0305-P4", "PIPE 9_2PV-E475M-0100-S0305-P5", "BODY 2-1_BJM-E472A-00-P4", "PIPE 9_2PV-E475M-0100-S0305"],
  "ROLL SAKTI": ["BODY 2-2_BJM-E472E-00", "BODY 1-1_2SU-E471A-00", "BODY 1-1_1FD-E471A-20", "BODY 2-2_B5D-E472E-0100-0305", "BODY 2-2_2PH-E472E-0000-0305", "BODY 2-1_BJM-E472A-00-P2", "BODY 2-2_DB2-E472E-0000-0905"]
};

// --- MAPPING ID ENTRY GOOGLE FORM ---
const PART_ENTRY_IDS: Record<string, string> = {
  "4X8 SILINCER": "entry.1580951855",
  "ARGON BJM": "entry.1613575464",
  "AUTO CHAMPER": "entry.428037183",
  "MANUAL CHAMPER": "entry.1146997133",
  "PRESS 110 T": "entry.2047060487",
  "SPM MIG TK TR": "entry.596398208",
  "PRESS 45 TON": "entry.260863508",
  "ROLL SAKTI": "entry.1271451779"
};

export default function LaporanKerjaForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk form
  const [formData, setFormData] = useState({
    tanggal: "", shift: "", operator: "", operatorLainnya: "",
    mesin: "", part: "",
    jamMulaiProses: "", jamSelesaiProses: "",
    qtyOk: "", qtyRepair: "", qtyReject: "",
    lembur: "", kendala: "",
    kendala4M: "", permasalahan: "", tindakan: "", pic: "",
    jamMulaiKendala: "", jamSelesaiKendala: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "mesin") setFormData((prev) => ({ ...prev, part: "" })); 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSd_Ju8f2S7Pfof3ZrkdDZrcy2omOIXBmNRrazgxixxIJnpCnQ/formResponse";
    const data = new URLSearchParams();

    // 1. DATA DASAR
    data.append("entry.623231028", formData.tanggal);
    data.append("entry.717102785", formData.shift);
    
    if (formData.operator === "Lainnya") {
      data.append("entry.53070038", "__other_option__");
      data.append("entry.53070038.other_option_response", formData.operatorLainnya);
    } else {
      data.append("entry.53070038", formData.operator);
    }
    
    data.append("entry.187334335", formData.mesin); 

    // 2. PART
    const targetPartEntry = PART_ENTRY_IDS[formData.mesin];
    if (targetPartEntry && formData.part) {
      data.append(targetPartEntry, formData.part);
    }

    // 3. HASIL PRODUKSI (Format Jam dipisah hour dan minute)
    if (formData.jamMulaiProses) {
       const [mulaiHour, mulaiMin] = formData.jamMulaiProses.split(":");
       data.append("entry.1771649841_hour", mulaiHour);
       data.append("entry.1771649841_minute", mulaiMin);
    }
    
    if (formData.jamSelesaiProses) {
       const [selesaiHour, selesaiMin] = formData.jamSelesaiProses.split(":");
       data.append("entry.406566829_hour", selesaiHour);
       data.append("entry.406566829_minute", selesaiMin);
    }

    data.append("entry.251036658", formData.qtyOk);
    data.append("entry.651874507", formData.qtyRepair);
    data.append("entry.104034433", formData.qtyReject);
    data.append("entry.655848224", formData.lembur);
    data.append("entry.1271181568", formData.kendala);

    // 4. DETAIL KENDALA
    if (formData.kendala === "Ada") {
      data.append("entry.2010474275", formData.kendala4M);
      data.append("entry.1212273594", formData.permasalahan);
      data.append("entry.415732501", formData.tindakan);
      data.append("entry.64399534", formData.pic);
      
      if (formData.jamMulaiKendala) {
         const [kendalaMulaiHour, kendalaMulaiMin] = formData.jamMulaiKendala.split(":");
         data.append("entry.71949914_hour", kendalaMulaiHour);
         data.append("entry.71949914_minute", kendalaMulaiMin);
      }
      
      if (formData.jamSelesaiKendala) {
         const [kendalaSelesaiHour, kendalaSelesaiMin] = formData.jamSelesaiKendala.split(":");
         data.append("entry.1051395701_hour", kendalaSelesaiHour);
         data.append("entry.1051395701_minute", kendalaSelesaiMin);
      }
    }

    // ==========================================
    // KUNCI RAHASIA: KALKULATOR RUTE (PAGE HISTORY)
    // ==========================================
    const PAGE_MAPPING: Record<string, number> = {
      "4X8 SILINCER": 1,
      "ARGON BJM": 2,
      "AUTO CHAMPER": 3,
      "MANUAL CHAMPER": 4,
      "PRESS 110 T": 5,
      "SPM MIG TK TR": 6,
      "PRESS 45 TON": 7,
      "ROLL SAKTI": 8
    };

    const history = [0]; // Selalu mulai dari Bagian 1 (index 0)
    
    if (formData.mesin && PAGE_MAPPING[formData.mesin]) {
      history.push(PAGE_MAPPING[formData.mesin]); // Tambahkan rute halaman part
    }
    
    history.push(9); // Selalu masuk ke Bagian 10 Hasil Produksi (index 9)

    if (formData.kendala === "Ada") {
      history.push(10); // Jika kendala Ada, masuk ke Bagian 11 (index 10)
    }

    // Gabungkan rute menjadi string dan kirimkan ke Google Form
    data.append("pageHistory", history.join(","));

    // ==========================================
    // EKSEKUSI PENGIRIMAN DATA
    // ==========================================
    try {
      await fetch(formUrl, {
        method: "POST",
        mode: "no-cors", // Kembali menggunakan no-cors agar tidak buka tab baru
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data.toString(),
      });
      
      alert("Laporan berhasil disubmit!");
      
      // Kosongkan form kembali
      setFormData({
        tanggal: "", shift: "", operator: "", operatorLainnya: "",
        mesin: "", part: "", jamMulaiProses: "", jamSelesaiProses: "",
        qtyOk: "", qtyRepair: "", qtyReject: "", lembur: "", kendala: "",
        kendala4M: "", permasalahan: "", tindakan: "", pic: "",
        jamMulaiKendala: "", jamSelesaiKendala: ""
      });
      
      window.scrollTo(0, 0); 
    } catch (error) {
      console.error("Error submitting form", error);
      alert("Gagal mengirim laporan. Periksa koneksi internet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-50 font-sans pb-24">
      <div className="bg-indigo-600 h-40 w-full absolute top-0 z-0"></div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Laporan Harian Kerja</h1>
          <p className="text-indigo-100 mt-2 font-medium">Line 1 Production System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 transition-all">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
              Informasi Dasar
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Tanggal Laporan <span className="text-red-500">*</span></label>
                <input type="date" name="tanggal" required value={formData.tanggal} onChange={handleChange} 
                  className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50 transition-all" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Shift <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {["1", "2"].map((s) => (
                    <label key={s} className="relative cursor-pointer">
                      <input type="radio" name="shift" value={s} required onChange={handleChange} checked={formData.shift === s} className="peer sr-only" />
                      <div className="p-3 border border-gray-200 rounded-xl text-center peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600 peer-hover:bg-gray-50 transition-all font-medium">
                        Shift {s}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2 mt-2">
                <label className="text-sm font-semibold text-gray-700">Pilih Mesin <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {MESIN_LIST.map((m) => (
                    <label key={m} className="relative cursor-pointer">
                      <input type="radio" name="mesin" value={m} required onChange={handleChange} checked={formData.mesin === m} className="peer sr-only" />
                      <div className="p-3 border border-gray-200 rounded-xl text-center text-xs md:text-sm peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600 hover:border-indigo-300 transition-all font-medium flex items-center justify-center h-full">
                        {m}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2 mt-2">
                <label className="text-sm font-semibold text-gray-700">Nama Operator <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {OPERATOR_LIST.map((op) => (
                    <label key={op} className="relative cursor-pointer">
                      <input type="radio" name="operator" value={op} required onChange={handleChange} checked={formData.operator === op} className="peer sr-only" />
                      <div className="p-3 border border-gray-200 rounded-xl text-center text-sm peer-checked:bg-indigo-100 peer-checked:text-indigo-800 peer-checked:border-indigo-400 hover:bg-gray-50 transition-all">
                        {op}
                      </div>
                    </label>
                  ))}
                </div>
                <div className={`grid transition-[grid-template-rows] duration-300 ${formData.operator === "Lainnya" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <input type="text" name="operatorLainnya" placeholder="Ketik nama operator..." required={formData.operator === "Lainnya"} value={formData.operatorLainnya} onChange={handleChange} 
                      className="w-full mt-3 border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50/50" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 */}
          <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${formData.mesin ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mt-2">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                  Detail Part <span className="text-indigo-600 ml-1">({formData.mesin})</span>
                </h2>
                <div className="flex flex-col gap-3">
                  {PART_MAPPING[formData.mesin]?.map((part) => (
                    <label key={part} className="relative cursor-pointer group">
                      <input type="radio" name="part" value={part} required onChange={handleChange} checked={formData.part === part} className="peer sr-only" />
                      <div className="p-4 border-2 border-gray-100 rounded-xl peer-checked:border-indigo-500 peer-checked:bg-indigo-50 group-hover:border-indigo-200 transition-all flex items-center justify-between">
                        <span className="font-medium text-gray-700 peer-checked:text-indigo-800">{part}</span>
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 flex items-center justify-center transition-all">
                           <div className={`w-2 h-2 rounded-full bg-white transition-opacity ${formData.part === part ? "opacity-100" : "opacity-0"}`}></div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
              Hasil Produksi
            </h2>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Jam Mulai <span className="text-red-500">*</span></label>
                <input type="time" name="jamMulaiProses" required value={formData.jamMulaiProses} onChange={handleChange} 
                  className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Jam Selesai <span className="text-red-500">*</span></label>
                <input type="time" name="jamSelesaiProses" required value={formData.jamSelesaiProses} onChange={handleChange} 
                  className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Qty OK <span className="text-red-500">*</span></label>
                <input type="number" name="qtyOk" min="0" required value={formData.qtyOk} onChange={handleChange} 
                  className="w-full border-gray-300 border p-3 rounded-xl text-center text-lg font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none bg-green-50/30" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Repair <span className="text-red-500">*</span></label>
                <input type="number" name="qtyRepair" min="0" required value={formData.qtyRepair} onChange={handleChange} 
                  className="w-full border-gray-300 border p-3 rounded-xl text-center text-lg font-bold text-yellow-700 focus:ring-2 focus:ring-yellow-500 outline-none bg-yellow-50/30" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Reject <span className="text-red-500">*</span></label>
                <input type="number" name="qtyReject" min="0" required value={formData.qtyReject} onChange={handleChange} 
                  className="w-full border-gray-300 border p-3 rounded-xl text-center text-lg font-bold text-red-700 focus:ring-2 focus:ring-red-500 outline-none bg-red-50/30" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Apakah ada lembur? <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  {["Yes", "No"].map((opt) => (
                    <label key={opt} className="relative cursor-pointer flex-1">
                      <input type="radio" name="lembur" value={opt} required onChange={handleChange} checked={formData.lembur === opt} className="peer sr-only" />
                      <div className="p-3 border border-gray-200 rounded-xl text-center peer-checked:bg-gray-800 peer-checked:text-white transition-all font-medium">
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
                    <input type="radio" name="kendala" value="Tidak" required onChange={handleChange} checked={formData.kendala === "Tidak"} className="peer sr-only" />
                    <div className="p-3 border border-gray-200 rounded-xl text-center peer-checked:bg-green-600 peer-checked:border-green-600 peer-checked:text-white transition-all font-medium">
                      Aman (Tidak Ada)
                    </div>
                  </label>
                  <label className="relative cursor-pointer flex-1">
                    <input type="radio" name="kendala" value="Ada" required onChange={handleChange} checked={formData.kendala === "Ada"} className="peer sr-only" />
                    <div className="p-3 border border-gray-200 rounded-xl text-center peer-checked:bg-red-600 peer-checked:border-red-600 peer-checked:text-white transition-all font-medium">
                      Ada Kendala
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4 */}
          <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${formData.kendala === "Ada" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="bg-red-50/50 rounded-2xl shadow-sm border border-red-200 p-6 md:p-8 mt-2">
                <h2 className="text-lg font-bold text-red-800 mb-6 flex items-center gap-2">
                  <span className="bg-red-200 text-red-800 w-8 h-8 rounded-full flex items-center justify-center text-sm">!</span>
                  Detail Kendala
                </h2>
                
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Kendala 4M <span className="text-red-500">*</span></label>
                    <select name="kendala4M" required={formData.kendala === "Ada"} value={formData.kendala4M} onChange={handleChange} 
                      className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white">
                      <option value="" disabled>-- Pilih Klasifikasi --</option>
                      <option value="MANUSIA">1. MANUSIA</option>
                      <option value="MESIN">2. MESIN</option>
                      <option value="MATERIAL">3. MATERIAL</option>
                      <option value="METODE">4. METODE</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Permasalahan <span className="text-red-500">*</span></label>
                    <textarea name="permasalahan" rows={2} required={formData.kendala === "Ada"} value={formData.permasalahan} onChange={handleChange} 
                      className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white placeholder-gray-400" placeholder="Deskripsikan masalah yang terjadi..."></textarea>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Tindakan <span className="text-red-500">*</span></label>
                    <textarea name="tindakan" rows={2} required={formData.kendala === "Ada"} value={formData.tindakan} onChange={handleChange} 
                      className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white placeholder-gray-400" placeholder="Langkah perbaikan yang dilakukan..."></textarea>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">PIC <span className="text-red-500">*</span></label>
                      <input type="text" name="pic" required={formData.kendala === "Ada"} value={formData.pic} onChange={handleChange} 
                        className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white" placeholder="Nama PIC..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Mulai Kendala <span className="text-red-500">*</span></label>
                      <input type="time" name="jamMulaiKendala" required={formData.kendala === "Ada"} value={formData.jamMulaiKendala} onChange={handleChange} 
                        className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Selesai Kendala <span className="text-red-500">*</span></label>
                      <input type="time" name="jamSelesaiKendala" required={formData.kendala === "Ada"} value={formData.jamSelesaiKendala} onChange={handleChange} 
                        className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-gray-200 p-4 z-50">
            <div className="max-w-4xl mx-auto flex justify-end">
              <button type="submit" disabled={isSubmitting} 
                className="w-full md:w-auto px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-red-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                {isSubmitting ? "Memproses..." : "Kirim Laporan (Cari Error)"}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}