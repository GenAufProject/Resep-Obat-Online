import React, { useState, useMemo } from "react";
import { Prescription, MonthlyStats, CategorySummary } from "@/src/types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { 
  CalendarRange, 
  LineChart, 
  Layers, 
  TrendingUp, 
  Package, 
  Activity, 
  FileText 
} from "lucide-react";

interface MonthlyAnalyticsProps {
  prescriptions: Prescription[];
}

export const MonthlyAnalytics: React.FC<MonthlyAnalyticsProps> = ({ prescriptions }) => {
  // 1. Group and sort prescriptions into monthly intervals automatically
  const monthlyStatsList = useMemo((): MonthlyStats[] => {
    const monthsMap: { [key: string]: { prescriptionCount: number; medicines: { [cat: string]: { count: number; totalQty: number } } } } = {};

    prescriptions.forEach((item) => {
      // Extract year and month, e.g., "2026-06"
      const dateParts = item.date.split("-");
      if (dateParts.length < 2) return;
      const monthKey = `${dateParts[0]}-${dateParts[1]}`;

      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = {
          prescriptionCount: 0,
          medicines: {}
        };
      }

      monthsMap[monthKey].prescriptionCount += 1;

      item.medicines.forEach((med) => {
        const cat = med.kategori || "Lain-lain";
        if (!monthsMap[monthKey].medicines[cat]) {
          monthsMap[monthKey].medicines[cat] = { count: 0, totalQty: 0 };
        }
        monthsMap[monthKey].medicines[cat].count += 1;
        monthsMap[monthKey].medicines[cat].totalQty += med.jumlah;
      });
    });

    // Translate to MonthlyStats objects
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktobers", "November", "Desember"
    ];

    const list: MonthlyStats[] = Object.keys(monthsMap).map((mKey) => {
      const [year, monthStr] = mKey.split("-");
      const monthIndex = parseInt(monthStr, 10) - 1;
      const monthName = `${monthNames[monthIndex] || "Bulan"} ${year}`;

      const totalQuantity = Object.values(monthsMap[mKey].medicines).reduce((sum, item) => sum + item.totalQty, 0);

      const categories: CategorySummary[] = Object.entries(monthsMap[mKey].medicines).map(([cat, detail]) => {
        return {
          kategori: cat,
          count: detail.count,
          totalJumlah: detail.totalQty,
          percentage: totalQuantity > 0 ? Math.round((detail.totalQty / totalQuantity) * 100) : 0
        };
      }).sort((a, b) => b.totalJumlah - a.totalJumlah); // Sort by quantity descending

      return {
        monthKey: mKey,
        monthName,
        prescriptionCount: monthsMap[mKey].prescriptionCount,
        totalQuantity,
        categories
      };
    });

    // Sort months descending (latest month first)
    return list.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [prescriptions]);

  // Handle selected month state
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Find all medicines under a given category for the selected active month
  const getMedicinesInCategory = (categoryName: string) => {
    if (!activeStats) return [];
    
    // Aggregation map
    const drugCounts: Record<string, number> = {};
    
    // Filter prescriptions matching selected month
    const matchingPrescriptions = prescriptions.filter(
      (p) => p.date && p.date.substring(0, 7) === activeStats.monthKey
    );
    
    matchingPrescriptions.forEach((p) => {
      p.medicines.forEach((med) => {
        // Fallback to "Lain-lain" if category isn't matching standard
        const cat = med.kategori || "Lain-lain";
        if (cat === categoryName) {
          const name = med.nama.trim();
          drugCounts[name] = (drugCounts[name] || 0) + med.jumlah;
        }
      });
    });
    
    // Clean list sorted by total quantity descending
    return Object.entries(drugCounts)
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah);
  };

  // Auto-set the latest month if no month is selected or selected month is invalid
  const activeStats = useMemo(() => {
    if (monthlyStatsList.length === 0) return null;

    const findSelected = monthlyStatsList.find(m => m.monthKey === selectedMonthKey);
    if (findSelected) return findSelected;

    // Fallback to latest month
    return monthlyStatsList[0];
  }, [monthlyStatsList, selectedMonthKey]);

  // Set the drop-down selector value
  const dropdownValue = activeStats ? activeStats.monthKey : "";

  // Prepare chart data for recharts
  const chartData = useMemo(() => {
    if (!activeStats) return [];
    
    // Sort by quantity descending for professional presentation in BarChart
    return activeStats.categories.map((catSpec) => ({
      name: catSpec.kategori.split(" (")[0], // Trim long category suffix for neat layout
      "Kuantitas Obat": catSpec.totalJumlah,
      "Macam Obat": catSpec.count,
    }));
  }, [activeStats]);

  // Beautiful modern colors for active bars (matching requested color scheme)
  const colorsList = [
    "#07575b", // Brand Active Teal
    "#ec92b5", // Pastel Pink
    "#ffb30f", // Pastel Honey Yellow
    "#003b46", // Deep Navy Teal
    "#dfd1af"  // Cream Sage shadow
  ];

  if (prescriptions.length === 0) {
    return (
      <div id="no-analytics-data" className="bg-[#fdf0d5]/40 border-2 border-brand-light p-8 rounded-2xl text-center space-y-3 shadow-[0_4px_24px_-4px_rgba(0,59,70,0.05)]">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-between mx-auto border border-brand-light">
          <Activity className="w-6 h-6 text-brand-medium mx-auto" />
        </div>
        <h3 className="text-brand-dark font-extrabold text-base">Grafik Konsumsi Belum Tersedia</h3>
        <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
          Tambahkan resep obat terlebih dahulu agar statistik dan grafik konsumsi resep otomatis dibuat di bagian ini.
        </p>
      </div>
    );
  }

  return (
    <div id="analytics-section" className="space-y-6">
      {/* Month Selector header */}
      <div className="bg-white border-2 border-brand-light p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_4px_24px_-4px_rgba(0,59,70,0.06)] text-[#003b46]">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="text-lg font-extrabold text-[#003b46] flex items-center gap-2 justify-center sm:justify-start">
            <LineChart className="w-5 h-5 text-brand-medium" />
            <span>Grafik & Pemetaan Otomatis Bulanan</span>
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            Data resep dikelompokkan dan disortir berdasarkan kategori obat per bulan secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="text-xs text-slate-500 font-extrabold uppercase tracking-wide flex items-center gap-1">
            <CalendarRange className="w-3.5 h-3.5 text-brand-medium" />
            Pilih Bulan:
          </label>
          <select
            id="select-month-analytics"
            value={dropdownValue}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="bg-brand-light/35 text-brand-dark rounded-xl border border-brand-light py-2 px-3.5 text-xs font-bold focus:border-brand-medium focus:outline-none transition leading-none"
          >
            {monthlyStatsList.map((m) => (
              <option key={m.monthKey} value={m.monthKey}>
                {m.monthName} ({m.prescriptionCount} Resep)
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Column */}
          <div className="lg:col-span-2 bg-white border-2 border-brand-light p-5 rounded-2xl space-y-4 shadow-[0_4px_24px_-4px_rgba(0,59,70,0.05)]">
            <div className="flex items-center justify-between border-b border-brand-light/30 pb-3">
              <h3 className="text-xs font-extrabold text-[#003b46] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-medium" />
                Grafik Konsumsi Kategori: {activeStats.monthName}
              </h3>
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-450">
                Unit: Butir / Tablet / Pcs
              </span>
            </div>

            {/* Recharts container */}
            <div className="h-72 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 10, left: -25, bottom: 5 }}
                    barGap={6}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#fdf0d5" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#07575b" 
                      fontSize={10} 
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                    />
                    <YAxis 
                      stroke="#07575b" 
                      fontSize={10} 
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fdf0d5",
                        borderColor: "#dfd1af",
                        borderRadius: "12px",
                        color: "#003b46",
                        fontSize: "12px",
                        fontWeight: "700",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                      }}
                      itemStyle={{ color: "#003b46" }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", color: "#07575b", fontWeight: "600" }}
                    />
                    <Bar 
                      dataKey="Kuantitas Obat" 
                      fill="#07575b" 
                      radius={[6, 6, 0, 0]} 
                      barSize={32}
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={colorsList[index % colorsList.length]} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  Tidak ada data untuk dirender
                </div>
              )}
            </div>
          </div>

          {/* Categorized List Metrics Column */}
          <div className="bg-white border-2 border-brand-light p-5 rounded-2xl flex flex-col justify-between shadow-[0_4px_24px_-4px_rgba(0,59,70,0.05)]">
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold text-[#003b46] uppercase tracking-wider flex items-center gap-2 border-b border-brand-light/35 pb-3">
                <Layers className="w-4 h-4 text-brand-medium" />
                Sortir Kategori ({activeStats.categories.length})
              </h3>

              <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-1">
                {activeStats.categories.map((cat, idx) => {
                  const isSelected = selectedCategory === cat.kategori;
                  const categoryDrugs = isSelected ? getMedicinesInCategory(cat.kategori) : [];
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedCategory(isSelected ? null : cat.kategori)}
                      className={`p-3 rounded-xl border-2 flex flex-col gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? "bg-brand-medium/10 border-brand-medium shadow-sm scale-[1.01]"
                          : "bg-[#fdf0d5]/15 border-brand-light/40 hover:border-brand-medium/50 hover:bg-[#fdf0d5]/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-bold text-brand-dark leading-tight">
                          {cat.kategori}
                        </span>
                        <span className="text-[10px] font-extrabold text-[#003b46] bg-brand-pink/25 px-2 py-0.5 rounded-md shrink-0 border border-brand-pink/35">
                          {cat.percentage}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-[#dfd1af]/30 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-brand-medium h-full rounded-full transition-all duration-500"
                          style={{ width: `${cat.percentage}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>Macam Obat: {cat.count}</span>
                        <span className="text-brand-medium">Total: {cat.totalJumlah} pcs</span>
                      </div>

                      {/* Micro interaction indicator */}
                      <div className="text-[9px] text-[#07575b] font-black flex items-center justify-end gap-0.5 mt-0.5 uppercase tracking-tighter">
                        {isSelected ? "▲ Tutup Detail" : "▼ Klik Lihat Rincian Obat"}
                      </div>

                      {/* Expandable medicine breakdown details */}
                      {isSelected && (
                        <div 
                          className="mt-2 pt-2 border-t border-brand-light/50 space-y-1.5"
                          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking within details
                        >
                          {categoryDrugs.length > 0 ? (
                            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                              {categoryDrugs.map((drug, dIdx) => (
                                <div key={dIdx} className="flex items-center justify-between text-[11px] bg-white py-1.5 px-2.5 rounded-lg border border-brand-light/30">
                                  <span className="font-bold text-slate-700">{drug.nama}</span>
                                  <span className="font-black text-brand-medium shrink-0 bg-brand-light/20 px-1.5 py-0.5 rounded">
                                    {drug.jumlah} pcs
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">Tidak ada obat terekam dalam kategori ini.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Summary Widgets */}
            <div className="mt-4 pt-3 border-t border-[#dfd1af]/30 grid grid-cols-2 gap-2 text-center">
              <div className="bg-[#fdf0d5]/15 p-2.5 rounded-xl border border-brand-light">
                <div className="text-[9px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-0.5 justify-center">
                  <FileText className="w-3 h-3 text-brand-medium" />
                  Total Resep
                </div>
                <div className="text-base font-extrabold text-[#003b46] mt-0.5">
                  {activeStats.prescriptionCount}
                </div>
              </div>
              <div className="bg-[#fdf0d5]/15 p-2.5 rounded-xl border border-brand-light">
                <div className="text-[9px] uppercase font-bold tracking-wider text-slate-450 flex items-center gap-0.5 justify-center">
                  <Package className="w-3 h-3 text-brand-medium" />
                  Total Obat
                </div>
                <div className="text-base font-extrabold text-[#003b46] mt-0.5">
                  {activeStats.totalQuantity} <span className="text-[10px] text-slate-500 font-normal">pcs</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
