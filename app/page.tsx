// "use client";

// import { useState } from "react";

// // --- DATA REFERENSI ---
// const OPERATOR_LIST = [
//   "Nanang Sunaryo", "Edwin Hardianto", "Arif nurhadi", "Hanif Mustofa",
//   "Sarmita", "Bayu Aji Prakoso", "Kamung Suryana", "Agus Susanto",
//   "Asep Rudiyono", "Abdul Rohman", "Lainnya"
// ];

// const MESIN_LIST = [
//   "4X8 SILINCER", "ARGON BJM", "AUTO CHAMPER", "MANUAL CHAMPER",
//   "SPM MIG TK TR", "PRESS 110 T", "PRESS 45 TON", "ROLL SAKTI"
// ];

// const PART_MAPPING: Record<string, string[]> = {
//   "4X8 SILINCER": ["4X8 SILINCER_4X8-E4753-0000-0310"],
//   "ARGON BJM": ["BODY 2-1_BJM-E472A-00-P3"],
//   "AUTO CHAMPER": ["PIPE 1_BPA-E4742-0000-0335", "PIPE 1_BLS-E475A-0000-0305", "PIPE 1_DB2-E4741-0000-0635"],
//   "MANUAL CHAMPER": ["PIPE BOARD_SCP-45060-0000-0305"],
//   "SPM MIG TK TR": ["AUX TK_EJAPROD-SUBACM002", "AUX TR_EJAPROD-SUBACM001"],
//   "PRESS 110 T": ["PIPE 1_B6H-E475A-0000-0305", "BODY 1-3_BSS-E471F-0000-0305", "BODY 1-1_BK6-E471A-0000-0905", "PIPE 1-1_B65-E461H-0000-0305", "PIPE 7_BJM-475K-00", "DIFFUSER CP_B0P-E4785-0100-0305-P4", "PIPE 9_2PV-E475M-0100-S0305"],
//   "PRESS 45 TON": ["DIFFUSER CP_B0P-E4785-0100-0305-P4", "PIPE 9_2PV-E475M-0100-S0305-P4", "PIPE 9_2PV-E475M-0100-S0305-P5", "BODY 2-1_BJM-E472A-00-P4", "PIPE 9_2PV-E475M-0100-S0305"],
//   "ROLL SAKTI": ["BODY 2-2_BJM-E472E-00", "BODY 1-1_2SU-E471A-00", "BODY 1-1_1FD-E471A-20", "BODY 2-2_B5D-E472E-0100-0305", "BODY 2-2_2PH-E472E-0000-0305", "BODY 2-1_BJM-E472A-00-P2", "BODY 2-2_DB2-E472E-0000-0905"]
// };

// // --- MAPPING ID ENTRY GOOGLE FORM ---
// const PART_ENTRY_IDS: Record<string, string> = {
//   "4X8 SILINCER": "entry.1580951855",
//   "ARGON BJM": "entry.1613575464",
//   "AUTO CHAMPER": "entry.428037183",
//   "MANUAL CHAMPER": "entry.1146997133",
//   "PRESS 110 T": "entry.2047060487",
//   "SPM MIG TK TR": "entry.596398208",
//   "PRESS 45 TON": "entry.260863508",
//   "ROLL SAKTI": "entry.1271451779"
// };

// export default function LaporanKerjaForm() {
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const [formData, setFormData] = useState({
//     tanggal: "", shift: "", 
//     operator: [] as string[], // Diubah jadi Array untuk bisa multi-select
//     operatorLainnya: "",
//     mesin: "", part: "",
//     jamMulaiProses: "", jamSelesaiProses: "",
//     qtyOk: "", qtyRepair: "", qtyReject: "",
//     lembur: "", kendala: "",
//     kendala4M: "", permasalahan: "", tindakan: "", pic: "",
//     jamMulaiKendala: "", jamSelesaiKendala: ""
//   });

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({ ...prev, [name]: value }));
//     if (name === "mesin") setFormData((prev) => ({ ...prev, part: "" })); 
//   };

//   // Handler khusus untuk Klik Operator (Checkbox)
//   const handleOperatorToggle = (op: string) => {
//     setFormData((prev) => {
//       const currentOps = prev.operator;
//       if (currentOps.includes(op)) {
//         return { ...prev, operator: currentOps.filter((o) => o !== op) }; // Hapus jika sudah diklik
//       } else {
//         return { ...prev, operator: [...currentOps, op] }; // Tambah jika belum diklik
//       }
//     });
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
    
//     // Validasi Operator Manual
//     if (formData.operator.length === 0) {
//       alert("Harap pilih minimal 1 Nama Operator!");
//       return;
//     }
    
//     setIsSubmitting(true);
    
//     const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSd_Ju8f2S7Pfof3ZrkdDZrcy2omOIXBmNRrazgxixxIJnpCnQ/formResponse";
//     const data = new URLSearchParams();

//     // 1. DATA DASAR
//     data.append("entry.623231028", formData.tanggal);
//     data.append("entry.717102785", formData.shift);
    
//     // Looping untuk mengirim setiap operator yang dicentang
//     formData.operator.forEach(op => {
//       if (op === "Lainnya") {
//         data.append("entry.53070038", "__other_option__");
//         data.append("entry.53070038.other_option_response", formData.operatorLainnya);
//       } else {
//         data.append("entry.53070038", op);
//       }
//     });
    
//     data.append("entry.187334335", formData.mesin); 

//     // 2. PART
//     const targetPartEntry = PART_ENTRY_IDS[formData.mesin];
//     if (targetPartEntry && formData.part) {
//       data.append(targetPartEntry, formData.part);
//     }

//     // 3. HASIL PRODUKSI 
//     if (formData.jamMulaiProses) {
//        const [mulaiHour, mulaiMin] = formData.jamMulaiProses.split(":");
//        data.append("entry.1771649841_hour", mulaiHour);
//        data.append("entry.1771649841_minute", mulaiMin);
//     }
//     if (formData.jamSelesaiProses) {
//        const [selesaiHour, selesaiMin] = formData.jamSelesaiProses.split(":");
//        data.append("entry.406566829_hour", selesaiHour);
//        data.append("entry.406566829_minute", selesaiMin);
//     }

//     data.append("entry.251036658", formData.qtyOk);
//     data.append("entry.651874507", formData.qtyRepair);
//     data.append("entry.104034433", formData.qtyReject);
//     data.append("entry.655848224", formData.lembur);
//     data.append("entry.1271181568", formData.kendala);

//     // 4. DETAIL KENDALA
//     if (formData.kendala === "Ada") {
//       data.append("entry.2010474275", formData.kendala4M);
//       data.append("entry.1212273594", formData.permasalahan);
//       data.append("entry.415732501", formData.tindakan);
//       data.append("entry.64399534", formData.pic);
      
//       if (formData.jamMulaiKendala) {
//          const [kendalaMulaiHour, kendalaMulaiMin] = formData.jamMulaiKendala.split(":");
//          data.append("entry.71949914_hour", kendalaMulaiHour);
//          data.append("entry.71949914_minute", kendalaMulaiMin);
//       }
//       if (formData.jamSelesaiKendala) {
//          const [kendalaSelesaiHour, kendalaSelesaiMin] = formData.jamSelesaiKendala.split(":");
//          data.append("entry.1051395701_hour", kendalaSelesaiHour);
//          data.append("entry.1051395701_minute", kendalaSelesaiMin);
//       }
//     }

//     // LOGIKA RUTE PAGE HISTORY
//     const PAGE_MAPPING: Record<string, number> = {
//       "4X8 SILINCER": 1,
//       "ARGON BJM": 2,
//       "AUTO CHAMPER": 3,
//       "MANUAL CHAMPER": 4,
//       "PRESS 110 T": 5,
//       "SPM MIG TK TR": 6,
//       "PRESS 45 TON": 7,
//       "ROLL SAKTI": 8
//     };

//     const history = [0]; 
//     if (formData.mesin && PAGE_MAPPING[formData.mesin]) history.push(PAGE_MAPPING[formData.mesin]); 
//     history.push(9); 
//     if (formData.kendala === "Ada") history.push(10); 

//     data.append("pageHistory", history.join(","));

//     try {
//       await fetch(formUrl, {
//         method: "POST",
//         mode: "no-cors",
//         headers: { "Content-Type": "application/x-www-form-urlencoded" },
//         body: data.toString(),
//       });
      
//       alert("Laporan berhasil disubmit!");
      
//       setFormData({
//         tanggal: "", shift: "", operator: [], operatorLainnya: "", // Reset state kembali
//         mesin: "", part: "", jamMulaiProses: "", jamSelesaiProses: "",
//         qtyOk: "", qtyRepair: "", qtyReject: "", lembur: "", kendala: "",
//         kendala4M: "", permasalahan: "", tindakan: "", pic: "",
//         jamMulaiKendala: "", jamSelesaiKendala: ""
//       });
      
//       window.scrollTo(0, 0); 
//     } catch (error) {
//       console.error("Error submitting form", error);
//       alert("Gagal mengirim laporan. Periksa koneksi internet.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-50 font-sans pb-24">
//       {/* HEADER BIRU TUA BERLINDO */}
//       <div className="bg-blue-800 h-52 w-full absolute top-0 z-0 rounded-b-3xl shadow-lg"></div>

//       <div className="relative z-10 max-w-4xl mx-auto px-4 pt-10">
        
//         {/* HEADER DENGAN LOGO */}
//         <div className="text-center mb-8 flex flex-col items-center justify-center">
//           <div className="bg-white px-6 py-3 rounded-2xl shadow-md mb-4 inline-flex items-center justify-center border border-gray-100">
//             <img 
//               src="/logo-berlindo.png" 
//               alt="Logo PT Berlindo Mitra Utama" 
//               className="h-10 md:h-12 w-auto object-contain" 
//             />
//           </div>
//           <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">Laporan Harian Kerja</h1>
//           <p className="text-blue-100 mt-2 font-medium tracking-wide">Line 1 Production System</p>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-6">
          
//           {/* SECTION 1: INFORMASI DASAR */}
//           <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 md:p-8 transition-all">
//             <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3 border-b pb-3">
//               <span className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">1</span>
//               Informasi Dasar
//             </h2>
            
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               <div className="space-y-2">
//                 <label className="text-sm font-semibold text-gray-700">Tanggal Laporan <span className="text-red-500">*</span></label>
//                 <input type="date" name="tanggal" required value={formData.tanggal} onChange={handleChange} 
//                   className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white text-gray-900 transition-all shadow-sm" />
//               </div>

//               <div className="space-y-2">
//                 <label className="text-sm font-semibold text-gray-700">Shift <span className="text-red-500">*</span></label>
//                 <div className="grid grid-cols-2 gap-3">
//                   {["1", "2"].map((s) => (
//                     <label key={s} className="relative cursor-pointer">
//                       <input type="radio" name="shift" value={s} required onChange={handleChange} checked={formData.shift === s} className="peer sr-only" />
//                       <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center peer-checked:bg-orange-500 peer-checked:text-white peer-checked:border-orange-500 hover:border-orange-300 transition-all font-semibold shadow-sm">
//                         Shift {s}
//                       </div>
//                     </label>
//                   ))}
//                 </div>
//               </div>

//               <div className="space-y-2 md:col-span-2 mt-2">
//                 <label className="text-sm font-semibold text-gray-700">Pilih Mesin <span className="text-red-500">*</span></label>
//                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//                   {MESIN_LIST.map((m) => (
//                     <label key={m} className="relative cursor-pointer">
//                       <input type="radio" name="mesin" value={m} required onChange={handleChange} checked={formData.mesin === m} className="peer sr-only" />
//                       <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center text-xs md:text-sm peer-checked:bg-orange-500 peer-checked:text-white peer-checked:border-orange-500 hover:border-orange-300 transition-all font-semibold flex items-center justify-center h-full shadow-sm">
//                         {m}
//                       </div>
//                     </label>
//                   ))}
//                 </div>
//               </div>

//               <div className="space-y-2 md:col-span-2 mt-2">
//                 <label className="text-sm font-semibold text-gray-700">Nama Operator <span className="text-red-500">*</span></label>
//                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//                   {OPERATOR_LIST.map((op) => (
//                     <label key={op} className="relative cursor-pointer">
//                       {/* Diubah jadi checkbox & memanggil handleOperatorToggle */}
//                       <input type="checkbox" name="operator" value={op} onChange={() => handleOperatorToggle(op)} checked={formData.operator.includes(op)} className="peer sr-only" />
//                       <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center text-sm peer-checked:bg-blue-50 peer-checked:text-blue-800 peer-checked:border-blue-500 hover:border-blue-300 transition-all font-semibold shadow-sm">
//                         {op}
//                       </div>
//                     </label>
//                   ))}
//                 </div>
//                 <div className={`grid transition-[grid-template-rows] duration-300 ${formData.operator.includes("Lainnya") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
//                   <div className="overflow-hidden">
//                     <input type="text" name="operatorLainnya" placeholder="Ketik nama operator..." required={formData.operator.includes("Lainnya")} value={formData.operatorLainnya} onChange={handleChange} 
//                       className="w-full mt-3 border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 shadow-sm" />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* SECTION 2: PILIH PART */}
//           <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${formData.mesin ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
//             <div className="overflow-hidden">
//               <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 md:p-8 mt-2">
//                 <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-3 border-b pb-3">
//                   <span className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">2</span>
//                   Detail Part <span className="text-orange-600 ml-1">({formData.mesin})</span>
//                 </h2>
//                 <div className="flex flex-col gap-3">
//                   {PART_MAPPING[formData.mesin]?.map((part) => (
//                     <label key={part} className="relative cursor-pointer group">
//                       <input type="radio" name="part" value={part} required onChange={handleChange} checked={formData.part === part} className="peer sr-only" />
//                       <div className="p-4 border-2 border-gray-200 bg-white rounded-xl peer-checked:border-orange-500 peer-checked:bg-orange-50 hover:border-orange-300 transition-all flex items-center justify-between shadow-sm">
//                         <span className="font-semibold text-gray-800 peer-checked:text-orange-800">{part}</span>
//                         <div className="w-5 h-5 rounded-full border-2 border-gray-300 peer-checked:border-orange-600 peer-checked:bg-orange-600 flex items-center justify-center transition-all bg-white">
//                            <div className={`w-2 h-2 rounded-full bg-white transition-opacity ${formData.part === part ? "opacity-100" : "opacity-0"}`}></div>
//                         </div>
//                       </div>
//                     </label>
//                   ))}
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* SECTION 3: HASIL PRODUKSI */}
//           <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 md:p-8">
//             <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3 border-b pb-3">
//               <span className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">3</span>
//               Hasil Produksi
//             </h2>
            
//             <div className="grid grid-cols-2 gap-6 mb-6">
//               <div className="space-y-2">
//                 <label className="text-sm font-semibold text-gray-700">Jam Mulai <span className="text-red-500">*</span></label>
//                 <input type="time" name="jamMulaiProses" required value={formData.jamMulaiProses} onChange={handleChange} 
//                   className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 shadow-sm" />
//               </div>
//               <div className="space-y-2">
//                 <label className="text-sm font-semibold text-gray-700">Jam Selesai <span className="text-red-500">*</span></label>
//                 <input type="time" name="jamSelesaiProses" required value={formData.jamSelesaiProses} onChange={handleChange} 
//                   className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 shadow-sm" />
//               </div>
//             </div>

//             <div className="grid grid-cols-3 gap-4 mb-6">
//               <div className="space-y-2">
//                 <label className="text-sm font-semibold text-gray-700">Qty OK <span className="text-red-500">*</span></label>
//                 <input type="number" name="qtyOk" min="0" required value={formData.qtyOk} onChange={handleChange} 
//                   className="w-full border-gray-300 border p-3 rounded-xl text-center text-lg font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none bg-green-50 shadow-sm" />
//               </div>
              
//               <div className="space-y-1">
//                 <label className="text-sm font-semibold text-gray-700">Repair <span className="text-red-500">*</span></label>
//                 <input type="number" name="qtyRepair" min="0" required value={formData.qtyRepair} onChange={handleChange} 
//                   className="w-full border-gray-300 border p-3 rounded-xl text-center text-lg font-bold text-orange-600 focus:ring-2 focus:ring-orange-500 outline-none bg-orange-50 shadow-sm" />
//                 <p className="text-[10px] md:text-xs text-red-500 italic text-center leading-tight">
//                   *Jika ada, isikan "Ada Kendala"
//                 </p>
//               </div>
              
//               <div className="space-y-1">
//                 <label className="text-sm font-semibold text-gray-700">Reject <span className="text-red-500">*</span></label>
//                 <input type="number" name="qtyReject" min="0" required value={formData.qtyReject} onChange={handleChange} 
//                   className="w-full border-gray-300 border p-3 rounded-xl text-center text-lg font-bold text-red-700 focus:ring-2 focus:ring-red-500 outline-none bg-red-50 shadow-sm" />
//                 <p className="text-[10px] md:text-xs text-red-500 italic text-center leading-tight">
//                   *Jika ada, isikan "Ada Kendala"
//                 </p>
//               </div>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
//               <div className="space-y-2">
//                 <label className="text-sm font-semibold text-gray-700">Apakah ada lembur? <span className="text-red-500">*</span></label>
//                 <div className="flex gap-3">
//                   {["Yes", "No"].map((opt) => (
//                     <label key={opt} className="relative cursor-pointer flex-1">
//                       <input type="radio" name="lembur" value={opt} required onChange={handleChange} checked={formData.lembur === opt} className="peer sr-only" />
//                       <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center peer-checked:bg-blue-800 peer-checked:text-white transition-all font-semibold shadow-sm">
//                         {opt}
//                       </div>
//                     </label>
//                   ))}
//                 </div>
//               </div>

//               <div className="space-y-2">
//                 <label className="text-sm font-semibold text-gray-700">Status Kendala <span className="text-red-500">*</span></label>
//                 <div className="flex gap-3">
//                   <label className="relative cursor-pointer flex-1">
//                     <input type="radio" name="kendala" value="Tidak" required onChange={handleChange} checked={formData.kendala === "Tidak"} className="peer sr-only" />
//                     <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center peer-checked:bg-green-600 peer-checked:border-green-600 peer-checked:text-white transition-all font-semibold shadow-sm">
//                       Aman (Tidak Ada)
//                     </div>
//                   </label>
//                   <label className="relative cursor-pointer flex-1">
//                     <input type="radio" name="kendala" value="Ada" required onChange={handleChange} checked={formData.kendala === "Ada"} className="peer sr-only" />
//                     <div className="p-3 border border-gray-300 bg-white text-gray-800 rounded-xl text-center peer-checked:bg-red-600 peer-checked:border-red-600 peer-checked:text-white transition-all font-semibold shadow-sm">
//                       Ada Kendala
//                     </div>
//                   </label>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* SECTION 4: DETAIL KENDALA */}
//           <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${formData.kendala === "Ada" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
//             <div className="overflow-hidden">
//               <div className="bg-red-50 rounded-2xl shadow-md border border-red-200 p-6 md:p-8 mt-2">
//                 <h2 className="text-lg font-bold text-red-800 mb-6 flex items-center gap-3 border-b border-red-200 pb-3">
//                   <span className="bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">!</span>
//                   Detail Kendala
//                 </h2>
                
//                 <div className="space-y-5">
//                   <div className="space-y-2">
//                     <label className="text-sm font-semibold text-gray-800">Kendala 4M <span className="text-red-500">*</span></label>
//                     <select name="kendala4M" required={formData.kendala === "Ada"} value={formData.kendala4M} onChange={handleChange} 
//                       className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 shadow-sm">
//                       <option value="" disabled>-- Pilih Klasifikasi --</option>
//                       <option value="MANUSIA">1. MANUSIA</option>
//                       <option value="MESIN">2. MESIN</option>
//                       <option value="MATERIAL">3. MATERIAL</option>
//                       <option value="METODE">4. METODE</option>
//                     </select>
//                   </div>

//                   <div className="space-y-2">
//                     <label className="text-sm font-semibold text-gray-800">Permasalahan <span className="text-red-500">*</span></label>
//                     <textarea name="permasalahan" rows={2} required={formData.kendala === "Ada"} value={formData.permasalahan} onChange={handleChange} 
//                       className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 placeholder-gray-400 shadow-sm" placeholder="Deskripsikan masalah yang terjadi..."></textarea>
//                   </div>

//                   <div className="space-y-2">
//                     <label className="text-sm font-semibold text-gray-800">Tindakan <span className="text-red-500">*</span></label>
//                     <textarea name="tindakan" rows={2} required={formData.kendala === "Ada"} value={formData.tindakan} onChange={handleChange} 
//                       className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 placeholder-gray-400 shadow-sm" placeholder="Langkah perbaikan yang dilakukan..."></textarea>
//                   </div>

//                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//                     <div className="space-y-2">
//                       <label className="text-sm font-semibold text-gray-800">PIC <span className="text-red-500">*</span></label>
//                       <input type="text" name="pic" required={formData.kendala === "Ada"} value={formData.pic} onChange={handleChange} 
//                         className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 shadow-sm" placeholder="Nama PIC..." />
//                     </div>
//                     <div className="space-y-2">
//                       <label className="text-sm font-semibold text-gray-800">Mulai Kendala <span className="text-red-500">*</span></label>
//                       <input type="time" name="jamMulaiKendala" required={formData.kendala === "Ada"} value={formData.jamMulaiKendala} onChange={handleChange} 
//                         className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 shadow-sm" />
//                     </div>
//                     <div className="space-y-2">
//                       <label className="text-sm font-semibold text-gray-800">Selesai Kendala <span className="text-red-500">*</span></label>
//                       <input type="time" name="jamSelesaiKendala" required={formData.kendala === "Ada"} value={formData.jamSelesaiKendala} onChange={handleChange} 
//                         className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white text-gray-900 shadow-sm" />
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* STICKY SUBMIT BUTTON */}
//           <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
//             <div className="max-w-4xl mx-auto flex justify-end">
//               <button type="submit" disabled={isSubmitting} 
//                 className="w-full md:w-auto px-10 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-extrabold text-lg shadow-lg shadow-orange-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
//                 {isSubmitting ? "Mengirim Data..." : "Kirim Laporan"}
//               </button>
//             </div>
//           </div>

//         </form>
//       </div>
//     </div>
//   );
// }

"use client";

import { useState, useMemo, useEffect } from "react";
import MAPPING_FORM from "../constants/formMapping.json";

// ============================================================
// TYPES
// ============================================================
type MachineConfig = {
  entryId: string;
  options: string[];
  page?: number; // opsional: nomor section/halaman mesin ini di Google Form
};

type LineConfig = {
  url: string;
  entries: Record<string, string>;
  operators: string[];
  mesin_part_mapping: Record<string, MachineConfig>;
  pages?: { resultPage?: number; kendalaPage?: number };
};

const MAPPING = MAPPING_FORM as Record<string, LineConfig>;

// ============================================================
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

const initialForm = {
  tanggal: "",
  shift: "1",
  operator: [] as string[],
  operatorLainnya: "",
  mesin: "",
  part: "",
  // Produksi
  jamMulaiProses: "",
  jamSelesaiProses: "",
  qtyOk: "",
  qtyRepair: "",
  qtyReject: "",
  lembur: "",
  kendala: "Tidak",
  // Khusus Line 8
  jenisAktivitas: "",
  jumlahSambungan: "",
  jumlahSambunganLainnya: "",
  // Kendala
  kendala4M: "",
  permasalahan: "",
  tindakan: "",
  pic: "",
  jamMulaiKendala: "",
  jamSelesaiKendala: "",
  // Dandori (Line 8)
  tanggalMulaiDandori: "",
  jamMulaiDandori: "",
  tanggalSelesaiDandori: "",
  jamSelesaiDandori: "",
  tahapDandori: "",
  hasilDandori: "",
  catatanDandori: "",
};

export default function LaporanKerjaForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lineSelected, setLineSelected] = useState<string>("LINE_1");
  const [formData, setFormData] = useState(initialForm);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // --- Config aktif ---
  const currentConfig = MAPPING[lineSelected];
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
    setFormData((prev) => ({
      ...prev,
      mesin: "", part: "", operator: [], operatorLainnya: "",
      jenisAktivitas: "", jumlahSambungan: "", jumlahSambunganLainnya: "",
      tanggalMulaiDandori: "", jamMulaiDandori: "", tanggalSelesaiDandori: "",
      jamSelesaiDandori: "", tahapDandori: "", hasilDandori: "", catatanDandori: "",
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "mesin" ? { part: "" } : {}),
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

    if (formData.operator.length === 0) {
      setToast({ type: "error", msg: "Harap pilih minimal 1 Nama Operator!" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    const formUrl = currentConfig.url;
    const data = new URLSearchParams();
    const entries = currentConfig.entries;

    const appendTime = (baseId: string | undefined, value: string) => {
      if (!baseId || !value) return;
      const [h, m] = value.split(":");
      data.append(`${baseId}_hour`, String(parseInt(h, 10)));
      data.append(`${baseId}_minute`, String(parseInt(m, 10)));
    };

    // 1. DATA DASAR (halaman 0)
    if (entries.tanggal) data.append(entries.tanggal, formData.tanggal);
    if (entries.shift) data.append(entries.shift, formData.shift);
    if (entries.mesin) data.append(entries.mesin, formData.mesin);

    if (entries.operator) {
      formData.operator.forEach((op) => {
        if (op === "__other_option__") {
          data.append(entries.operator, "__other_option__");
          data.append(`${entries.operator}.other_option_response`, formData.operatorLainnya);
        } else {
          data.append(entries.operator, op);
        }
      });
    }

    // PART
    const targetPartEntryId = selectedMesinData?.entryId;
    if (targetPartEntryId && formData.part) data.append(targetPartEntryId, formData.part);

    // JENIS AKTIVITAS (khusus Line 8)
    if (isLine8 && entries.jenis_aktivitas) {
      data.append(entries.jenis_aktivitas, formData.jenisAktivitas);
    }

    // 3. JALUR PRODUKSI
    if (showProduction) {
      appendTime(entries.jam_mulai_proses, formData.jamMulaiProses);
      appendTime(entries.jam_selesai_proses, formData.jamSelesaiProses);
      if (entries.qty_ok) data.append(entries.qty_ok, formData.qtyOk);
      if (entries.qty_repair) data.append(entries.qty_repair, formData.qtyRepair);
      if (entries.qty_reject) data.append(entries.qty_reject, formData.qtyReject);
      if (entries.lembur) data.append(entries.lembur, formData.lembur);

      // Jumlah Sambungan (opsional, khusus Line 8)
      if (isLine8 && entries.jumlah_sambungan && formData.jumlahSambungan) {
        if (formData.jumlahSambungan === "__other_option__") {
          data.append(entries.jumlah_sambungan, "__other_option__");
          data.append(`${entries.jumlah_sambungan}.other_option_response`, formData.jumlahSambunganLainnya);
        } else {
          data.append(entries.jumlah_sambungan, formData.jumlahSambungan);
        }
      }

      if (entries.ada_kendala) data.append(entries.ada_kendala, formData.kendala);

      // Detail kendala
      if (formData.kendala === "Ada") {
        if (entries.kendala_4m) data.append(entries.kendala_4m, formData.kendala4M);
        if (entries.permasalahan) data.append(entries.permasalahan, formData.permasalahan);
        if (entries.tindakan) data.append(entries.tindakan, formData.tindakan);
        if (entries.pic) data.append(entries.pic, formData.pic);
        appendTime(entries.jam_mulai_kendala, formData.jamMulaiKendala);
        appendTime(entries.jam_selesai_kendala, formData.jamSelesaiKendala);
      }
    }

    // 4. JALUR DANDORI (khusus Line 8) — tanpa qty
    if (showDandori) {
      // Tanggal dikirim sbg "YYYY-MM-DD" (sama seperti field Tanggal Laporan yg sudah terbukti masuk)
      if (entries.tanggal_mulai_dandori) data.append(entries.tanggal_mulai_dandori, formData.tanggalMulaiDandori);
      appendTime(entries.jam_mulai_dandori, formData.jamMulaiDandori);
      if (entries.tanggal_selesai_dandori) data.append(entries.tanggal_selesai_dandori, formData.tanggalSelesaiDandori);
      appendTime(entries.jam_selesai_dandori, formData.jamSelesaiDandori);
      if (entries.tahap_dandori) data.append(entries.tahap_dandori, formData.tahapDandori);
      if (entries.hasil_dandori) data.append(entries.hasil_dandori, formData.hasilDandori);
      if (entries.catatan_dandori && formData.catatanDandori)
        data.append(entries.catatan_dandori, formData.catatanDandori);
    }

    // ============================================================
    // pageHistory — menentukan halaman mana yg jawabannya disimpan
    // ============================================================
    let history: number[];
    if (isLine8) {
      // Bagian 1=0, Produksi=1, Detail Kendala=2, Dandori=3
      if (showDandori) {
        history = [0, 3];
      } else {
        history = formData.kendala === "Ada" ? [0, 1, 2] : [0, 1];
      }
    } else {
      const machineIndex = listMesin.indexOf(formData.mesin);
      const machinePage = selectedMesinData?.page ?? (machineIndex >= 0 ? machineIndex + 1 : null);
      const resultPage = currentConfig.pages?.resultPage ?? listMesin.length + 1;
      const kendalaPage = currentConfig.pages?.kendalaPage ?? listMesin.length + 2;
      history = [0];
      if (machinePage !== null) history.push(machinePage);
      history.push(resultPage);
      if (formData.kendala === "Ada") history.push(kendalaPage);
    }

    data.append("fvv", "1");
    data.append("pageHistory", history.join(","));
    data.append("submit", "Submit");

    try {
      await fetch(formUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data.toString(),
      });

      setToast({ type: "success", msg: "Laporan berhasil dikirim! ✅" });
      setFormData(initialForm);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Error submitting form", error);
      setToast({ type: "error", msg: "Gagal mengirim. Periksa koneksi internet." });
    } finally {
      setIsSubmitting(false);
    }
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-md">
          <div
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
            <img
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  value={lineSelected}
                  onChange={handleLineChange}
                  className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50 text-blue-900 font-bold shadow-sm"
                >
                  {Object.keys(MAPPING).map((l) => (
                    <option key={l} value={l}>{l.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              {/* TANGGAL */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Tanggal Laporan <span className="text-red-500">*</span>
                </label>
                <input type="date" name="tanggal" required value={formData.tanggal} onChange={handleChange}
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
                        <input type="radio" name="jenisAktivitas" value={j} required={isLine8} onChange={handleChange} checked={formData.jenisAktivitas === j} className="peer sr-only" />
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

              <div className="grid grid-cols-2 gap-6 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Jam Mulai <span className="text-red-500">*</span></label>
                  <input type="time" name="jamMulaiProses" required={showProduction} value={formData.jamMulaiProses} onChange={handleChange}
                    className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 shadow-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Jam Selesai <span className="text-red-500">*</span></label>
                  <input type="time" name="jamSelesaiProses" required={showProduction} value={formData.jamSelesaiProses} onChange={handleChange}
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
                      name={f.name}
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

          {/* STICKY SUBMIT */}
          <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="hidden sm:block text-xs text-gray-500 leading-tight">
                <span className="font-bold text-blue-800">{lineSelected.replace("_", " ")}</span>
                {isLine8 && formData.jenisAktivitas && <> • {formData.jenisAktivitas}</>}
                {formData.operator.length > 0 && <> • {formData.operator.length} operator</>}
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full sm:w-auto px-10 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-extrabold text-lg shadow-lg shadow-orange-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                {isSubmitting ? "Mengirim Data..." : "Kirim Laporan"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
