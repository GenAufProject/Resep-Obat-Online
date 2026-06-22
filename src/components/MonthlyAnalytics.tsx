import React, { useState, useMemo, useEffect } from "react";
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
  Cell,
  LineChart as RechartsLineChart,
  Line
} from "recharts";
import { 
  CalendarRange, 
  LineChart, 
  Layers, 
  TrendingUp, 
  Package, 
  Activity, 
  FileText,
  Scale,
  GitCompare,
  Check,
  Search,
  X,
  Plus
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

  // Get all unique medicine names from all prescriptions
  const allUniqueMedicines = useMemo(() => {
    const medsSet = new Set<string>();
    prescriptions.forEach((p) => {
      p.medicines.forEach((m) => {
        if (m.nama && m.nama.trim()) {
          medsSet.add(m.nama.trim());
        }
      });
    });
    return Array.from(medsSet).sort((a, b) => a.localeCompare(b));
  }, [prescriptions]);

  const [selectedTrendMeds, setSelectedTrendMeds] = useState<string[]>([]);
  const [medSearchQuery, setMedSearchQuery] = useState<string>("");

  // Target states for Trend range
  const [trendStartDate, setTrendStartDate] = useState<string>("");
  const [trendEndDate, setTrendEndDate] = useState<string>("");

  // Determine active start and end strings based on loaded prescriptions if not user-defined
  const activeTrendRange = useMemo(() => {
    if (prescriptions.length === 0) {
      return { startStr: "", endStr: "" };
    }
    const dates = prescriptions.map((p) => p.date).filter(Boolean).sort();
    const minDate = dates[0] || "";
    const maxDate = dates[dates.length - 1] || "";
    
    return {
      startStr: trendStartDate || minDate,
      endStr: trendEndDate || maxDate,
    };
  }, [prescriptions, trendStartDate, trendEndDate]);

  // Populate initially with top used medicines
  useEffect(() => {
    if (selectedTrendMeds.length === 0 && allUniqueMedicines.length > 0) {
      const occurrences: { [name: string]: number } = {};
      prescriptions.forEach((p) => {
        p.medicines.forEach((m) => {
          if (m.nama && m.nama.trim()) {
            const trimmed = m.nama.trim();
            occurrences[trimmed] = (occurrences[trimmed] || 0) + m.jumlah;
          }
        });
      });
      const sortedByPopularity = Object.entries(occurrences)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
      setSelectedTrendMeds(sortedByPopularity.slice(0, 3));
    }
  }, [allUniqueMedicines, prescriptions]);

  const filteredMedsForSelector = useMemo(() => {
    if (!medSearchQuery.trim()) {
      return allUniqueMedicines;
    }
    const q = medSearchQuery.toLowerCase();
    return allUniqueMedicines.filter((m) => m.toLowerCase().includes(q));
  }, [allUniqueMedicines, medSearchQuery]);

  // Construct medicine trend historical chronological dataset divided into exactly 5 equal intervals
  const trendData = useMemo(() => {
    if (selectedTrendMeds.length === 0 || prescriptions.length === 0) return [];
    const { startStr, endStr } = activeTrendRange;
    if (!startStr || !endStr) return [];

    // Helper to parse local daily midnight timezone-safely
    const parseLocalDate = (dateStr: string) => {
      const parts = dateStr.split("-");
      if (parts.length < 3) return new Date();
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day, 0, 0, 0, 0);
    };

    const startDateObj = parseLocalDate(startStr);
    const endDateObj = parseLocalDate(endStr);

    if (startDateObj > endDateObj) {
      return [];
    }

    const startMs = startDateObj.getTime();
    const endMs = endDateObj.getTime();
    const rangeMs = endMs - startMs;

    const intervals: { start: Date; end: Date; label: string }[] = [];
    const monthLetters = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    
    const formatShortDate = (d: Date) => {
      const date = d.getDate();
      return `${date} ${monthLetters[d.getMonth()]}`;
    };

    if (rangeMs <= 0) {
      const dayMs = 24 * 60 * 60 * 1000;
      const step = dayMs / 5;
      for (let i = 0; i < 5; i++) {
        const intervalStart = new Date(startMs + step * i);
        const intervalEnd = new Date(startMs + step * (i + 1));
        const label = `${formatShortDate(intervalStart)} - ${formatShortDate(intervalEnd)}`;
        intervals.push({ start: intervalStart, end: intervalEnd, label });
      }
    } else {
      const stepMs = rangeMs / 5;
      for (let i = 0; i < 5; i++) {
        const intervalStart = new Date(startMs + stepMs * i);
        const intervalEnd = new Date(startMs + stepMs * (i + 1));
        const actualEnd = i === 4 ? endDateObj : intervalEnd;
        const sLabel = formatShortDate(intervalStart);
        const eLabel = formatShortDate(actualEnd);
        const label = sLabel === eLabel ? sLabel : `${sLabel} - ${eLabel}`;
        intervals.push({ start: intervalStart, end: actualEnd, label });
      }
    }

    return intervals.map((interval) => {
      const medsQty: { [med: string]: number } = {};
      selectedTrendMeds.forEach((medName) => {
        medsQty[medName] = 0;
      });

      prescriptions.forEach((p) => {
        if (!p.date) return;
        const pDate = parseLocalDate(p.date);
        pDate.setHours(0, 0, 0, 0);

        const intervalStartMidnight = new Date(interval.start);
        intervalStartMidnight.setHours(0, 0, 0, 0);
        const intervalEndMidnight = new Date(interval.end);
        intervalEndMidnight.setHours(23, 59, 59, 999);

        if (pDate >= intervalStartMidnight && pDate <= intervalEndMidnight) {
          p.medicines.forEach((m) => {
            const trimmedName = m.nama?.trim();
            if (trimmedName && selectedTrendMeds.includes(trimmedName)) {
              medsQty[trimmedName] = (medsQty[trimmedName] || 0) + (m.jumlah || 0);
            }
          });
        }
      });

      return {
        monthName: interval.label,
        ...medsQty
      };
    });
  }, [prescriptions, selectedTrendMeds, activeTrendRange]);

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

  // Aggregate daily prescription counts for the selected month vs previous month side-by-side
  const comparisonData = useMemo(() => {
    if (!activeStats) return { data: [], currentLabel: "", prevLabel: "" };

    const currentMonthKey = activeStats.monthKey;
    const [currentYear, currentMonthStr] = currentMonthKey.split("-").map(Number);

    // Calculate previous month key safely
    let prevYear = currentYear;
    let prevMonth = currentMonthStr - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    const monthNamesIndo = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const currentMonthLabel = `${monthNamesIndo[currentMonthStr - 1]} ${currentYear}`;
    const prevMonthLabel = `${monthNamesIndo[prevMonth - 1]} ${prevYear}`;

    // Month days boundaries
    const totalDaysInMonth = new Date(currentYear, currentMonthStr, 0).getDate();

    // Initialize counts for days 1 to totalDaysInMonth
    const currentDaysMap: Record<number, number> = {};
    const prevDaysMap: Record<number, number> = {};

    for (let d = 1; d <= 31; d++) {
      currentDaysMap[d] = 0;
      prevDaysMap[d] = 0;
    }

    prescriptions.forEach((p) => {
      if (!p.date) return;
      const parts = p.date.split("-");
      if (parts.length < 3) return;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      const mKey = `${parts[0]}-${String(month).padStart(2, "0")}`;
      if (mKey === currentMonthKey) {
        currentDaysMap[day] = (currentDaysMap[day] || 0) + 1;
      } else if (mKey === prevMonthKey) {
        prevDaysMap[day] = (prevDaysMap[day] || 0) + 1;
      }
    });

    const dataList = [];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const activeLabel = `Hari ${day}`;
      dataList.push({
        dayName: activeLabel,
        dayNumber: day,
        "Bulan Terpilih": currentDaysMap[day] || 0,
        "Bulan Sebelumnya": prevDaysMap[day] || 0,
      });
    }

    return {
      data: dataList,
      currentLabel: currentMonthLabel,
      prevLabel: prevMonthLabel,
    };
  }, [prescriptions, activeStats]);

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

      {/* Side-by-side Prescriptions Comparison Line Chart Card */}
      {activeStats && (
        <div id="monthly-comparison-card" className="bg-white border-2 border-brand-light p-6 rounded-2xl space-y-4 shadow-[0_4px_24px_-4px_rgba(0,59,70,0.05)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-brand-light/30 pb-3 gap-2">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold text-[#003b46] uppercase tracking-wider flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-brand-medium" />
                Perbandingan Resep Masuk Harian (Bulan Ini vs Bulan Lalu)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Membandingkan frekuensi harian resep medis yang masuk antara <strong className="text-[#07575b]">{comparisonData.currentLabel}</strong> dan <strong className="text-brand-medium">{comparisonData.prevLabel}</strong>.
              </p>
            </div>
            <span className="text-[10px] bg-[#07575b]/10 text-[#07575b] font-black px-2.5 py-1 rounded-lg">
              Sumbu X: Tanggal 1 s/d {comparisonData.data.length}
            </span>
          </div>

          <div className="h-72 w-full">
            {comparisonData.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart
                  data={comparisonData.data}
                  margin={{ top: 15, right: 15, left: -25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#fdf0d5" vertical={false} />
                  <XAxis 
                    dataKey="dayNumber" 
                    stroke="#07575b" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                    tickFormatter={(val) => `Tgl ${val}`}
                  />
                  <YAxis 
                    stroke="#07575b" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#fdf0d5] border border-[#dfd1af] p-3 rounded-xl shadow-lg space-y-1 text-xs">
                            <p className="font-extrabold text-brand-dark border-b border-brand-light/30 pb-1 mb-1">
                              Tanggal {label}
                            </p>
                            <p className="font-bold text-[#07575b]">
                              {comparisonData.currentLabel}: <span className="font-black">{payload[0]?.value} resep</span>
                            </p>
                            <p className="font-bold text-brand-medium">
                              {comparisonData.prevLabel}: <span className="font-black">{payload[1]?.value} resep</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px", fontWeight: "600" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Bulan Terpilih"
                    name={`${comparisonData.currentLabel} (Bulan Ini)`}
                    stroke="#07575b"
                    strokeWidth={3}
                    activeDot={{ r: 6 }}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Bulan Sebelumnya"
                    name={`${comparisonData.prevLabel} (Bulan Sebelumnya)`}
                    stroke="#ec92b5"
                    strokeWidth={3}
                    activeDot={{ r: 6 }}
                    dot={{ r: 3 }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
                Data perbandingan tidak mencukupi
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Medicine Trend Analysis Section */}
      {prescriptions.length > 0 && (
        <div id="medicine-trend-card" className="bg-white border-2 border-brand-light p-6 rounded-2xl space-y-5 shadow-[0_4px_24px_-4px_rgba(0,59,70,0.05)]">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between border-b border-brand-light/30 pb-4 gap-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold text-[#003b46] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#07575b]" />
                Tren Konsumsi Nama Obat Spesifik
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Pilih hingga 5 macam obat. Grafik secara otomatis membagi rentang waktu terpilih menjadi 5 bagian kronologis.
              </p>
            </div>

            {/* Date Range Selectors for the Trend Graph with validation */}
            <div className="flex items-center gap-2.5 flex-wrap w-full xl:w-auto">
              <div className="flex flex-col gap-0.5 min-w-[120px]">
                <span className="text-[9px] uppercase font-bold text-[#07575b]/85">Mulai Tanggal</span>
                <input
                  type="date"
                  value={trendStartDate}
                  max={trendEndDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTrendStartDate(val);
                    if (val && trendEndDate && val > trendEndDate) {
                      setTrendEndDate(val);
                    }
                  }}
                  className="bg-[#07575b]/5 text-[#003b46] border border-brand-light rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-[#07575b] transition cursor-pointer"
                />
              </div>
              <span className="text-xs text-slate-400 font-bold self-end mb-1.5">—</span>
              <div className="flex flex-col gap-0.5 min-w-[120px]">
                <span className="text-[9px] uppercase font-bold text-[#07575b]/85">Sampai Tanggal</span>
                <input
                  type="date"
                  value={trendEndDate}
                  min={trendStartDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (trendStartDate && val && val < trendStartDate) {
                      setTrendEndDate(trendStartDate);
                    } else {
                      setTrendEndDate(val);
                    }
                  }}
                  className="bg-[#07575b]/5 text-[#003b46] border border-brand-light rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-[#07575b] transition cursor-pointer"
                />
              </div>
              {(trendStartDate || trendEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setTrendStartDate("");
                    setTrendEndDate("");
                  }}
                  className="text-[10px] text-red-600 hover:underline font-bold self-end mb-1.5 flex items-center gap-0.5 transition"
                  title="Hapus filter rentang grafik"
                >
                  <X className="w-3 h-3" /> Hapus Filter
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left selector panel */}
            <div className="lg:col-span-5 space-y-3.5 bg-[#fcfbfa] p-4 rounded-xl border border-brand-light/40">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-black tracking-widest text-[#003b46]/75">
                  Cari & Pilih Obat ({selectedTrendMeds.length}/5 terpilih)
                </label>
                
                {/* Search query input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#07575b]/60 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ketik nama obat untuk menyaring..."
                    value={medSearchQuery}
                    onChange={(e) => setMedSearchQuery(e.target.value)}
                    className="w-full bg-white text-xs text-[#003b46] pl-8 pr-3 py-2 border border-brand-light rounded-lg focus:border-[#07575b] focus:outline-none focus:ring-1 focus:ring-[#07575b] font-semibold"
                  />
                  {medSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMedSearchQuery("")}
                      className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-[#003b46] opacity-40 hover:opacity-100 bg-transparent border-none p-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Selected medicines display list */}
              {selectedTrendMeds.length > 0 && (
                <div className="space-y-1.5">
                  <span className="block text-[9px] uppercase font-bold text-slate-400">Sedang Ditampilkan:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTrendMeds.map((med, idx) => {
                      const colors = ["#07575b", "#ec92b5", "#f4a261", "#2a9d8f", "#457b9d"];
                      const color = colors[idx % colors.length];
                      return (
                        <div
                          key={med}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border leading-none bg-white shadow-xs"
                          style={{ borderColor: `${color}30`, color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate max-w-[120px]">{med}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedTrendMeds(prev => prev.filter(m => m !== med))}
                            className="hover:scale-110 active:scale-95 transition bg-transparent border-none p-0 cursor-pointer"
                            title="Hapus filter tren"
                          >
                            <X className="w-2.5 h-2.5 opacity-60 hover:opacity-100" style={{ color }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scrollable list of choices available */}
              <div className="space-y-1">
                <span className="block text-[9px] uppercase font-bold text-slate-400">Pilih dari Riwayat Input:</span>
                <div className="max-h-36 overflow-y-auto pr-1 space-y-1 border border-brand-light/30 rounded-lg p-1 bg-white scrollbar-thin">
                  {filteredMedsForSelector.length === 0 ? (
                    <div className="text-[10px] text-slate-450 italic py-3 text-center">
                      {allUniqueMedicines.length === 0 ? "Belum ada riwayat obat." : "Tidak ada hasil pencarian obat."}
                    </div>
                  ) : (
                    filteredMedsForSelector.map((med) => {
                      const isSelected = selectedTrendMeds.includes(med);
                      return (
                        <button
                          key={med}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTrendMeds(prev => prev.filter(m => m !== med));
                            } else {
                              if (selectedTrendMeds.length >= 5) {
                                return; // Hard limit capped at max 5 medicines
                              }
                              setSelectedTrendMeds(prev => [...prev, med]);
                            }
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-bold transition flex items-center justify-between cursor-pointer border ${
                            isSelected
                              ? "bg-[#07575b]/5 border-[#07575b]/30 text-[#07575b]"
                              : selectedTrendMeds.length >= 5
                                ? "bg-slate-50 border-slate-100 text-slate-350 cursor-not-allowed opacity-60"
                                : "bg-transparent border-transparent hover:bg-slate-50 text-[#003b46]/90 hover:text-[#003b46]"
                          }`}
                          disabled={!isSelected && selectedTrendMeds.length >= 5}
                          title={!isSelected && selectedTrendMeds.length >= 5 ? "Maksimal 5 nama obat dipilih. Hapus obat terpilih terlebih dahulu." : ""}
                        >
                          <span className="truncate max-w-[170px]">{med}</span>
                          <span className="shrink-0">
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 text-[#07575b]" strokeWidth={3} />
                            ) : (
                              selectedTrendMeds.length < 5 && <Plus className="w-3.5 h-3.5 text-slate-350 opacity-60 transition group-hover:opacity-100" />
                            )}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right chart trend panel */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              {selectedTrendMeds.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-[#dfd1af]/50 rounded-xl bg-[#fdf0d5]/5 p-5 text-center">
                  <Package className="w-8 h-8 text-[#07575b]/30 mb-2" />
                  <p className="text-xs font-bold text-slate-500">
                    Tidak ada obat terpilih untuk grafik tren.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[280px]">
                    Silakan tentukan atau klik beberapa nama obat di sisi kiri untuk menganalisis perkembangan konsumsinya.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black tracking-wider text-[#003b46]/75">
                      Kronologi Grafik Tren Penggunaan (Sumbu Y = Total Butir Obat)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTrendMeds([])}
                      className="text-[10px] text-red-600 hover:underline font-bold bg-transparent border-none p-0 cursor-pointer"
                    >
                      Reset pilihan obat
                    </button>
                  </div>
                  
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart
                        data={trendData}
                        margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#fdf0d5" vertical={false} />
                        <XAxis 
                          dataKey="monthName" 
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
                            fontSize: "11px",
                            fontWeight: "700",
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                          }}
                          itemStyle={{ fontSize: "10px", paddingPadding: "2px 0" }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          height={36} 
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: "10px", fontWeight: "600" }}
                        />
                        {selectedTrendMeds.map((med, index) => {
                          const colors = ["#07575b", "#ec92b5", "#f4a261", "#2a9d8f", "#457b9d"];
                          return (
                            <Line
                              key={med}
                              type="monotone"
                              dataKey={med}
                              name={med}
                              stroke={colors[index % colors.length]}
                              strokeWidth={2.5}
                              activeDot={{ r: 5 }}
                              dot={{ r: 2 }}
                            />
                          );
                        })}
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
