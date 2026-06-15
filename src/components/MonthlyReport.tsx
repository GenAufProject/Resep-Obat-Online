import React, { useState, useEffect, useMemo } from "react";
import { Prescription, MEDICINE_CATEGORIES } from "@/src/types";
import { Calendar, ClipboardList, Database, Save, RotateCcw, Info, ArrowDown, ArrowUp, AlertCircle, FileSpreadsheet, FileDown } from "lucide-react";
import { exportCategoryStockToExcel, exportCategoryStockToPDF } from "../utils/export";

interface MonthlyReportProps {
  prescriptions: Prescription[];
}

interface InventoryData {
  stokAwal: number;
  pemasukan: number;
}

// Map key format: "YYYY-MM_category_medicineName"
type InventoryMap = Record<string, InventoryData>;

export const MonthlyReport: React.FC<MonthlyReportProps> = ({ prescriptions }) => {
  // 1. Get list of available months in prescriptions (e.g. "2026-06", "2026-05")
  const availableMonths = useMemo(() => {
    const list = new Set<string>();
    
    // Always include current month as default
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    list.add(currentMonthKey);
    
    prescriptions.forEach((p) => {
      if (p.date && p.date.length >= 7) {
        list.add(p.date.substring(0, 7));
      }
    });
    
    return Array.from(list).sort((a, b) => b.localeCompare(a)); // Descending chronology
  }, [prescriptions]);

  // Selected Month state
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Populate default selected month
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Format YYYY-MM to Indonesian Month string
  const formatMonthName = (monthKey: string) => {
    if (!monthKey) return "";
    try {
      const [yearStr, monthStr] = monthKey.split("-");
      const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
      return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    } catch {
      return monthKey;
    }
  };

  // State for manual inventory (Stok Awal and Pemasukan)
  const [inventory, setInventory] = useState<InventoryMap>({});

  // 2. Load inventory from localStorage upon mount
  useEffect(() => {
    const cached = localStorage.getItem("rekap_stok_manual");
    if (cached) {
      try {
        setInventory(JSON.parse(cached));
      } catch (e) {
        console.error("Gagal load data stok manual:", e);
      }
    }
  }, []);

  // Update a single item's stock attribute
  const handleUpdateStock = (
    category: string,
    medicineName: string,
    field: keyof InventoryData,
    value: number
  ) => {
    const key = `${selectedMonth}_${category}_${medicineName}`;
    const updatedMap = {
      ...inventory,
      [key]: {
        stokAwal: 0,
        pemasukan: 0,
        ...(inventory[key] || {}),
        [field]: value < 0 || isNaN(value) ? 0 : value
      }
    };
    setInventory(updatedMap);
    localStorage.setItem("rekap_stok_manual", JSON.stringify(updatedMap));
  };

  // Reset inventory trigger
  const handleResetMonth = () => {
    setShowResetConfirm(true);
  };

  const executeResetMonth = () => {
    const updatedMap = { ...inventory };
    // Remove keys that match the selected month
    Object.keys(updatedMap).forEach((key) => {
      if (key.startsWith(`${selectedMonth}_`)) {
        delete updatedMap[key];
      }
    });
    setInventory(updatedMap);
    localStorage.setItem("rekap_stok_manual", JSON.stringify(updatedMap));
    setShowResetConfirm(false);
  };

  // 3. Aggregate prescription medicine outgoing counts for the selected month
  const monthlyMedicinesAggregated = useMemo(() => {
    const summary: Record<string, Record<string, number>> = {}; // keyed by: summary[category][medicineName] = totalQuantity
    
    // Initialize empty arrays for all 5 categories
    MEDICINE_CATEGORIES.forEach((cat) => {
      summary[cat] = {};
    });

    // Filter prescriptions matching selected month
    const matchingPrescriptions = prescriptions.filter((p) => p.date && p.date.substring(0, 7) === selectedMonth);

    // Accumulate outgoing quantities
    matchingPrescriptions.forEach((p) => {
      p.medicines.forEach((med) => {
        // Fallback to "Lain-lain" if category isn't matching our 5 categories
        const cat = MEDICINE_CATEGORIES.includes(med.kategori) ? med.kategori : "Lain-lain";
        const normalizedName = med.nama.trim();
        
        if (!summary[cat][normalizedName]) {
          summary[cat][normalizedName] = 0;
        }
        summary[cat][normalizedName] += med.jumlah;
      });
    });

    return summary;
  }, [prescriptions, selectedMonth]);

  return (
    <div id="monthly-report-view" className="space-y-6">
      {/* Top Controller Banner */}
      <div className="bg-white border-2 border-brand-light p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_4px_24px_-4px_rgba(0,59,70,0.06)] text-[#003b46]">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-medium" />
            Laporan Bulanan Stok Sediaan Obat
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Pemantauan laporan narkotika, psikotropika, & obat khusus berdasarkan sisa stok & data penyerapan resep.
          </p>
        </div>

        {/* Month Selector dropdown */}
        <div className="flex items-center gap-2.5 shrink-0">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pilih Bulan:</label>
          <select
            id="report-month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-brand-light/35 border-2 border-brand-light text-[#003b46] p-2.5 rounded-xl text-xs font-extrabold focus:border-brand-medium focus:outline-none"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthName(m)}
              </option>
            ))}
          </select>
          
          <button
            id="btn-reset-stock"
            onClick={handleResetMonth}
            title="Reset entri manual bulan ini"
            className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset stok
          </button>
        </div>
      </div>

      {/* Info Tip banner */}
      <div className="bg-brand-yellow/15 border-2 border-brand-yellow/30 text-[#855100] px-4 py-3.5 rounded-xl text-xs leading-relaxed flex items-start gap-2.5">
        <Info className="w-4 h-4 text-brand-yellow shrink-0 mt-0.5" />
        <div>
          <strong>Panduan Pengisian Laporan:</strong> Ketikkan angka <strong>Stok Awal</strong> & <strong>Jumlah Pemasukan</strong> langsung pada baris obat.
          Perubahan akan disimpan otomatis di memori internal browser Anda. Angka <strong>Pengeluaran</strong> dikalkulasi otomatis dari penulisan resep sediaan pasien selama bulan {formatMonthName(selectedMonth)}.
        </div>
      </div>

      <div className="space-y-8">
        {MEDICINE_CATEGORIES.map((category) => {
          const drugsMap = monthlyMedicinesAggregated[category] || {};
          const drugNamesList = Object.keys(drugsMap);

          const drugsToExport = drugNamesList.map((drugName) => {
            const outgoing = drugsMap[drugName];
            const invKey = `${selectedMonth}_${category}_${drugName}`;
            const userStock = inventory[invKey] || { stokAwal: 0, pemasukan: 0 };
            const finalStock = userStock.stokAwal + userStock.pemasukan - outgoing;
            return {
              nama: drugName,
              stokAwal: userStock.stokAwal,
              pemasukan: userStock.pemasukan,
              pengeluaran: outgoing,
              stokAkhir: finalStock
            };
          });

          return (
            <div
              key={category}
              className="bg-white border-2 border-brand-light rounded-2xl overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,59,70,0.04)]"
            >
              {/* Category banner */}
              <div className="bg-brand-dark px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#dfd1af]/30">
                <h3 className="font-extrabold text-white text-sm tracking-wide uppercase">
                  Kategori: {category}
                </h3>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="bg-brand-pink text-brand-dark px-3 py-1 text-[10px] uppercase font-black rounded-full shadow-xs">
                    {drugNamesList.length} Macam Obat
                  </span>
                  {drugNamesList.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportCategoryStockToExcel(category, formatMonthName(selectedMonth), drugsToExport)}
                        className="py-1 px-2.5 bg-[#07575b] hover:bg-[#07575b]/85 border border-[#dfd1af]/20 hover:border-[#dfd1af]/45 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                        title="Ekspor Excel (.csv)"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-brand-pink" />
                        <span>Ekspor Excel</span>
                      </button>
                      <button
                        onClick={() => exportCategoryStockToPDF(category, formatMonthName(selectedMonth), drugsToExport)}
                        className="py-1 px-2.5 bg-[#dfd1af]/20 hover:bg-[#dfd1af]/45 border border-[#dfd1af]/15 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                        title="Ekspor PDF (.pdf)"
                      >
                        <FileDown className="w-3.5 h-3.5 text-brand-pink" />
                        <span>Ekspor PDF (Text)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Table section */}
              {drugNamesList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand-light/25 border-b border-brand-light/60 font-extrabold text-brand-dark">
                        <th className="py-3.5 px-5">Nama Obat</th>
                        <th className="py-3.5 px-4 text-center w-36">Stok Awal</th>
                        <th className="py-3.5 px-4 text-center w-36">Jumlah Pemasukan</th>
                        <th className="py-3.5 px-4 text-center w-36">Jumlah Pengeluaran</th>
                        <th className="py-3.5 px-5 text-center w-40 bg-brand-light/10">Stok Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-light/30">
                      {drugNamesList.map((drugName) => {
                        const outgoing = drugsMap[drugName];
                        const invKey = `${selectedMonth}_${category}_${drugName}`;
                        const userStock = inventory[invKey] || { stokAwal: 0, pemasukan: 0 };
                        const finalStock = userStock.stokAwal + userStock.pemasukan - outgoing;

                        return (
                          <tr key={drugName} className="hover:bg-brand-light/10 text-slate-700 font-medium">
                            {/* Drug Name row */}
                            <td className="py-3.5 px-5 font-bold text-[#003b46]">{drugName}</td>
                            
                            {/* Stok Awal input */}
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={userStock.stokAwal || ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    handleUpdateStock(
                                      category,
                                      drugName,
                                      "stokAwal",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-20 text-center bg-brand-light/20 focus:bg-white text-brand-dark border border-[#dfd1af] focus:border-brand-medium rounded-lg p-1.5 focus:outline-none font-bold text-xs transition"
                                />
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase">pcs</span>
                              </div>
                            </td>

                            {/* Jumlah Pemasukan input */}
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 font-bold">
                                <span className="text-emerald-600 text-xs font-black">+</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={userStock.pemasukan || ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    handleUpdateStock(
                                      category,
                                      drugName,
                                      "pemasukan",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-20 text-center bg-brand-light/20 focus:bg-white text-brand-dark border border-[#dfd1af] focus:border-brand-medium rounded-lg p-1.5 focus:outline-none font-bold text-xs transition"
                                />
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase">pcs</span>
                              </div>
                            </td>

                            {/* Jumlah Pengeluaran quantity */}
                            <td className="py-3.5 px-4 text-center font-extrabold text-[#003b46] bg-slate-50/50">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-amber-500 font-black shrink-0">-</span>
                                <span>{outgoing}</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase ml-0.5">pcs</span>
                              </div>
                            </td>

                            {/* Stok Akhir */}
                            <td className={`py-3.5 px-5 text-center font-black text-sm bg-brand-light/10 ${finalStock < 0 ? 'text-rose-600 bg-rose-50/20' : 'text-[#07575b]'}`}>
                              <span>{finalStock}</span>
                              <span className="text-[10px] font-bold uppercase ml-1">pcs</span>
                              {finalStock < 0 && (
                                <div className="text-[9px] text-rose-500 font-bold mt-0.5 tracking-tighter flex items-center justify-center gap-0.5">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  <span>Defisit!</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50/30 text-slate-400 font-medium">
                  <Database className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <span>Tidak ada data pengeluaran obat kategori ini pada bulan {formatMonthName(selectedMonth)}.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-brand-dark/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#fdf0d5] ring-2 ring-[#dfd1af] p-6 rounded-2xl max-w-sm w-full shadow-2xl relative flex flex-col gap-4 text-[#003b46]">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-full shrink-0 border border-rose-100">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 border-none">
                <h3 className="font-extrabold text-sm text-[#003b46] tracking-tight uppercase">Konfirmasi Reset Stok</h3>
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                  Apakah Anda yakin ingin menyetel ulang (reset) data Stok Awal &amp; Pemasukan bulan <span className="text-[#07575b] font-bold">{formatMonthName(selectedMonth)}</span>? Tindakan ini tidak dapat dikembalikan.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#dfd1af]/30">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-white text-[#07575b] border border-[#dfd1af] rounded-xl text-xs font-bold transition hover:bg-neutral-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeResetMonth}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition shadow-sm cursor-pointer"
              >
                Ya, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
