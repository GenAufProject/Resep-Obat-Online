import React, { useState, useMemo } from "react";
import { Prescription, Medicine, MEDICINE_CATEGORIES } from "../types";
import { 
  Users, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Calendar, 
  User, 
  ExternalLink,
  Tag,
  Stethoscope,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { exportDoctorMedicineSummaryToPDF } from "../utils/export";

interface DoctorMedicineOverviewProps {
  prescriptions: Prescription[];
}

export const DoctorMedicineOverview: React.FC<DoctorMedicineOverviewProps> = ({ prescriptions }) => {
  const [doctorSearch, setDoctorSearch] = useState("");
  const [medicineSearch, setMedicineSearch] = useState("");
  const [doctorSort, setDoctorSort] = useState<"alphabet" | "count">("alphabet");
  const [medicineSort, setMedicineSort] = useState<"alphabet" | "count">("alphabet");
  
  // Track which doctor key or medicine key is expanded
  const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null);
  const [expandedMedicine, setExpandedMedicine] = useState<string | null>(null); // key format: "category_medname"
  
  // Selected prescription for a full-detail popup
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  // Total prescriptions count
  const totalPrescriptionsCount = prescriptions.length;

  // 1. Process Doctors alphabetically or by prescription count
  const doctorsData = useMemo(() => {
    const doctorMap = new Map<string, { name: string; count: number; list: Prescription[] }>();

    prescriptions.forEach(p => {
      const docName = p.doctor ? p.doctor.trim() : "Tanpa Nama Dokter";
      const docKey = docName.toLowerCase();

      if (!doctorMap.has(docKey)) {
        doctorMap.set(docKey, {
          name: docName,
          count: 0,
          list: []
        });
      }

      const entry = doctorMap.get(docKey)!;
      entry.count += 1;
      // Add prescription to the list
      entry.list.push(p);
    });

    const list = Array.from(doctorMap.values());
    if (doctorSort === "count") {
      return list.sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.name.localeCompare(b.name, "id");
      });
    } else {
      return list.sort((a, b) => a.name.localeCompare(b.name, "id"));
    }
  }, [prescriptions, doctorSort]);

  // 2. Process Medicines grouped by category and sorted dynamically
  const medicinesByCategory = useMemo(() => {
    // Initialize maps for standard categories plus a fallback "Lain-lain"
    const categoryMap = new Map<string, Map<string, { name: string; totalQty: number; rxCount: number; list: Prescription[] }>>();
    
    MEDICINE_CATEGORIES.forEach(cat => {
      categoryMap.set(cat, new Map());
    });

    prescriptions.forEach(p => {
      if (!p.medicines) return;
      p.medicines.forEach(m => {
        const cat = m.kategori || "Lain-lain";
        const medName = m.nama ? m.nama.trim() : "Tanpa Nama Obat";
        const medKey = medName.toLowerCase();

        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, new Map());
        }

        const medMap = categoryMap.get(cat)!;
        if (!medMap.has(medKey)) {
          medMap.set(medKey, {
            name: medName,
            totalQty: 0,
            rxCount: 0,
            list: []
          });
        }

        const entry = medMap.get(medKey)!;
        entry.totalQty += m.jumlah || 0;
        entry.rxCount += 1;
        // Add prescription containing this medicine (avoid duplicates)
        if (!entry.list.some(pItem => pItem.id === p.id)) {
          entry.list.push(p);
        }
      });
    });

    // Convert to structured categories and sort
    const result: { category: string; meds: { name: string; totalQty: number; rxCount: number; list: Prescription[] }[] }[] = [];
    
    categoryMap.forEach((medMap, category) => {
      const sortedMeds = Array.from(medMap.values());
      if (medicineSort === "count") {
        sortedMeds.sort((a, b) => {
          if (b.rxCount !== a.rxCount) {
            return b.rxCount - a.rxCount;
          }
          return a.name.localeCompare(b.name, "id");
        });
      } else {
        sortedMeds.sort((a, b) => a.name.localeCompare(b.name, "id"));
      }
      
      if (sortedMeds.length > 0) {
        result.push({
          category,
          meds: sortedMeds
        });
      }
    });

    return result;
  }, [prescriptions, medicineSort]);

  // Filters for search
  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return doctorsData;
    const query = doctorSearch.toLowerCase();
    return doctorsData.filter(d => d.name.toLowerCase().includes(query));
  }, [doctorsData, doctorSearch]);

  const filteredMedicinesByCategory = useMemo(() => {
    if (!medicineSearch.trim()) return medicinesByCategory;
    const query = medicineSearch.toLowerCase();
    
    return medicinesByCategory.map(group => {
      const filteredMeds = group.meds.filter(m => m.name.toLowerCase().includes(query));
      return {
        ...group,
        meds: filteredMeds
      };
    }).filter(group => group.meds.length > 0);
  }, [medicinesByCategory, medicineSearch]);

  const handleToggleDoctor = (docKey: string) => {
    if (expandedDoctor === docKey) {
      setExpandedDoctor(null);
    } else {
      setExpandedDoctor(docKey);
    }
  };

  const handleToggleMedicine = (medKey: string) => {
    if (expandedMedicine === medKey) {
      setExpandedMedicine(null);
    } else {
      setExpandedMedicine(medKey);
    }
  };

  // Find max doctor prescription count to set proportional scale bar
  const maxDoctorCount = useMemo(() => {
    if (doctorsData.length === 0) return 1;
    return Math.max(...doctorsData.map(d => d.count));
  }, [doctorsData]);

  // 3. Process Medicine Categories for Donut Chart (Soft Beachy Pastel Palette)
  const categoryDonutData = useMemo(() => {
    const categoryCounts: { [key: string]: number } = {};
    let totalQty = 0;

    prescriptions.forEach(p => {
      if (!p.medicines) return;
      p.medicines.forEach(m => {
        const cat = m.kategori || "Lain-lain";
        const qty = m.jumlah || 0;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + qty;
        totalQty += qty;
      });
    });

    const colorsMap: { [key: string]: string } = {
      "Narkotika": "#f43f5e",          // Soft Sunrise Pink / Rose-500
      "Psikotropika": "#fbbf24",       // Warm Beach Sand / Amber-400
      "Obat-obat Tertentu": "#0284c7",  // Deep Wave Blue / Sky-600
      "Prekursor": "#06b6d4",          // Clear Sea Turquoise / Cyan-500
      "Lain-lain": "#64748b",          // Sea Shell Gray / Slate-500
    };

    return Object.entries(categoryCounts).map(([name, value]) => {
      const percentage = totalQty > 0 ? (value / totalQty) * 100 : 0;
      return {
        name,
        value,
        percentage,
        color: colorsMap[name] || "#8b5cf6" // Default Purple for other categories
      };
    }).sort((a, b) => b.value - a.value);
  }, [prescriptions]);

  // Compute total quantity of medicines across all prescriptions
  const totalMedicinesQty = useMemo(() => {
    return categoryDonutData.reduce((sum, item) => sum + item.value, 0);
  }, [categoryDonutData]);

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* Top Section: Title Card & Category Donut Chart Card - CERAH BEACH THEME */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Title & Stats Card */}
        <div className="md:col-span-6 bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-white border border-[#bae6fd] p-5 rounded-2xl shadow-xs flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-base font-extrabold text-[#073b4c] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0ea5e9]" />
              Ikhtisar Relasi Dokter & Obat
            </h2>
            <p className="text-xs text-[#0284c7] font-semibold leading-relaxed">
              Analisis rekam data dokter penulis resep dan statistik obat berdasarkan kategori medis secara komprehensif. Gunakan diagram lingkaran di sebelah kanan untuk meninjau persentase kategori obat secara keseluruhan.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-[#fffbeb] border border-[#fde68a] text-[#b45309] text-xs font-extrabold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs">
                <Stethoscope className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span>Total Dokter: {doctorsData.length}</span>
              </div>
              <div className="bg-[#f0f9ff] border border-[#bae6fd] text-[#0369a1] text-xs font-extrabold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs">
                <FileText className="w-3.5 h-3.5 text-[#0ea5e9]" />
                <span>Total Resep: {totalPrescriptionsCount}</span>
              </div>
            </div>
            
            <button
              onClick={() => exportDoctorMedicineSummaryToPDF(doctorsData, medicinesByCategory)}
              disabled={prescriptions.length === 0}
              className={`relative flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-extrabold text-[#fdf0d5] rounded-xl border-2 transition-all duration-100 select-none ${
                prescriptions.length === 0
                  ? "bg-slate-300 border-slate-400 text-slate-500 cursor-not-allowed opacity-50"
                  : "bg-[#07575b] border-[#003b46] shadow-[3px_3px_0px_0px_rgba(0,59,70,1)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_rgba(0,59,70,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer"
              }`}
              title="Ekspor PDF Ringkasan Dokter & Obat"
            >
              <FileText className="w-3.5 h-3.5" />
              Ekspor PDF Ringkasan
            </button>
          </div>
        </div>

        {/* Donut Chart Card */}
        <div className="md:col-span-6 bg-white border border-[#bae6fd] p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-sky-100 pb-2 mb-2">
            <h3 className="text-xs font-extrabold text-[#073b4c] uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-[#0ea5e9]" />
              Proporsi Kategori Obat
            </h3>
          </div>

          {categoryDonutData.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 font-medium">
              Belum ada data obat untuk ditampilkan
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Donut Chart Canvas */}
              <div className="w-full sm:w-1/2 relative h-[140px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={58}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        `${value} pcs (${categoryDonutData.find(d => d.name === name)?.percentage.toFixed(1)}%)`,
                        name
                      ]}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#bae6fd",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        color: "#073b4c"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Absolute Centered Total Qty Label */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total</span>
                  <span className="text-xs font-extrabold text-[#073b4c]">{totalMedicinesQty}</span>
                  <span className="text-[8px] font-bold text-[#0ea5e9]">pcs</span>
                </div>
              </div>

              {/* Dynamic Legend / Categories Details */}
              <div className="w-full sm:w-1/2 space-y-1.5 overflow-y-auto max-h-[140px] pr-1 custom-scrollbar">
                {categoryDonutData.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between text-[11px] font-bold">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-slate-700 truncate" title={entry.name}>{entry.name}</span>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-1.5 ml-2">
                      <span className="text-slate-400 font-medium">{entry.value} pcs</span>
                      <span className="text-[#0369a1] bg-[#e0f2fe] px-1 py-0.5 rounded text-[10px] border border-[#bae6fd]">{entry.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Two-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: List of Doctors (5 cols) - CERAH BEACH THEME */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#bae6fd] rounded-2xl p-5 shadow-xs space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-100 pb-3">
              <h3 className="text-xs font-extrabold text-[#073b4c] uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-[#0ea5e9]" />
                Daftar Dokter ({filteredDoctors.length})
              </h3>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="text-[10px] font-bold text-slate-500">Urutkan:</span>
                <select
                  value={doctorSort}
                  onChange={(e) => setDoctorSort(e.target.value as "alphabet" | "count")}
                  className="bg-slate-50 border border-slate-200 text-[10px] font-extrabold text-[#0369a1] px-2 py-1 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0ea5e9] cursor-pointer"
                >
                  <option value="alphabet">Alfabet (A-Z)</option>
                  <option value="count">Resep Terbanyak</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-[#0ea5e9]" />
              <input
                type="text"
                placeholder="Cari nama dokter..."
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#f0f9ff]/60 border border-[#bae6fd] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#0ea5e9] text-slate-800 placeholder-[#0284c7]/50"
              />
            </div>

            {/* Doctor Lists */}
            <div className="space-y-2.5 max-h-[36rem] overflow-y-auto pr-1 custom-scrollbar">
              {filteredDoctors.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-medium">
                  Tidak ada dokter ditemukan
                </div>
              ) : (
                filteredDoctors.map((docItem) => {
                  const docKey = docItem.name.toLowerCase();
                  const isExpanded = expandedDoctor === docKey;
                  
                  // Calculate prescription percentage relative to total prescriptions
                  const percentageOfTotal = totalPrescriptionsCount > 0 
                    ? ((docItem.count / totalPrescriptionsCount) * 100) 
                    : 0;

                  // Calculate prescription percentage relative to maximum doctor count for visual bar scaling
                  const percentageOfMax = maxDoctorCount > 0 
                    ? ((docItem.count / maxDoctorCount) * 100) 
                    : 0;
                  
                  return (
                    <div 
                      key={docKey}
                      className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                        isExpanded 
                          ? "border-[#0ea5e9] bg-[#f0f9ff] shadow-xs" 
                          : "border-[#e0f2fe] bg-[#fdfefe] hover:bg-[#f0f9ff]"
                      }`}
                    >
                      {/* Doctor Card Header */}
                      <button
                        onClick={() => handleToggleDoctor(docKey)}
                        className="w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between text-left cursor-pointer gap-2"
                      >
                        <div className="space-y-1 flex-1">
                          <h4 className="text-xs font-extrabold text-[#073b4c]">
                            {docItem.name}
                          </h4>
                          
                          {/* Visual progress bar & contribution percentage next to name */}
                          <div className="flex items-center gap-2.5 mt-1.5 max-w-[200px]">
                            <div className="w-full bg-[#e0f2fe] h-1.5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${percentageOfMax}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="bg-[#0ea5e9] h-full rounded-full" 
                              />
                            </div>
                            <span className="text-[10px] font-extrabold text-[#0369a1] shrink-0 bg-[#e0f2fe] px-1.5 py-0.5 rounded-md border border-[#bae6fd]">
                              {percentageOfTotal.toFixed(1)}%
                            </span>
                          </div>
                          
                          <span className="text-[10px] text-slate-500 font-medium block">
                            {docItem.count} Resep ditulis dari seluruh rekap
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <span className="text-[9px] bg-[#0ea5e9] text-white font-extrabold px-2.5 py-1 rounded-full shadow-xs">
                            {docItem.list.length} Rx
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#0369a1]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#0369a1]" />
                          )}
                        </div>
                      </button>

                      {/* Doctor Collapsible Prescription List */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-[#bae6fd] px-4 py-3 bg-white"
                          >
                            <div className="text-[9px] font-extrabold text-[#0369a1] uppercase tracking-wider mb-2">
                              TERCATAT PADA LEMBAR RESEP BERIKUT:
                            </div>
                            <div className="space-y-1.5 pb-1">
                              {docItem.list.map((rx) => (
                                <div 
                                  key={rx.id}
                                  onClick={() => setSelectedPrescription(rx)}
                                  className="group flex items-center justify-between p-2 rounded-xl hover:bg-[#f0f9ff] border border-[#fdfefe] hover:border-[#bae6fd] cursor-pointer transition-all text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-[#0ea5e9] shrink-0" />
                                    <span className="font-mono font-bold text-[#073b4c]">
                                      {rx.prescriptionNo}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5 text-[10px] text-slate-500">
                                    <span className="font-semibold text-slate-700">{rx.patientName}</span>
                                    <span className="flex items-center gap-0.5 font-medium shrink-0">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {rx.date}
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-[#0ea5e9]/50 group-hover:text-[#0ea5e9] transition-colors" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: List of Medicines by Category (7 cols) - CERAH BEACH THEME */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#bae6fd] rounded-2xl p-5 shadow-xs space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-100 pb-3">
              <h3 className="text-xs font-extrabold text-[#073b4c] uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-[#0ea5e9]" />
                Daftar Obat Berdasarkan Kategori
              </h3>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="text-[10px] font-bold text-slate-500">Urutkan:</span>
                <select
                  value={medicineSort}
                  onChange={(e) => setMedicineSort(e.target.value as "alphabet" | "count")}
                  className="bg-slate-50 border border-slate-200 text-[10px] font-extrabold text-[#0369a1] px-2 py-1 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0ea5e9] cursor-pointer"
                >
                  <option value="alphabet">Alfabet (A-Z)</option>
                  <option value="count">Resep Terbanyak</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-[#0ea5e9]" />
              <input
                type="text"
                placeholder="Cari nama obat..."
                value={medicineSearch}
                onChange={(e) => setMedicineSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#f0f9ff]/60 border border-[#bae6fd] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#0ea5e9] text-slate-800 placeholder-[#0284c7]/50"
              />
            </div>

            {/* Grouped Lists */}
            <div className="space-y-5 max-h-[36rem] overflow-y-auto pr-1 custom-scrollbar">
              {filteredMedicinesByCategory.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-medium">
                  Tidak ada obat ditemukan
                </div>
              ) : (
                filteredMedicinesByCategory.map((group) => (
                  <div key={group.category} className="space-y-2.5">
                    
                    {/* Category Divider Header */}
                    <div className="flex items-center gap-2 px-1">
                      <span className="h-2 w-2 rounded-full bg-[#0ea5e9]"></span>
                      <span className="text-[11px] font-extrabold text-[#0369a1] uppercase tracking-wider">
                        Kategori {group.category}
                      </span>
                      <span className="text-[10px] font-extrabold text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded-md border border-[#bae6fd]">
                        {group.meds.length} Macam Obat
                      </span>
                      <div className="flex-1 h-px bg-[#bae6fd]"></div>
                    </div>

                    {/* Category Medicine Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.meds.map((med) => {
                        const medKey = `${group.category}_${med.name.toLowerCase()}`;
                        const isExpanded = expandedMedicine === medKey;
                        
                        return (
                          <div 
                            key={medKey}
                            className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                              isExpanded 
                                ? "border-[#0ea5e9] bg-[#f0f9ff] shadow-xs sm:col-span-2" 
                                : "border-[#e0f2fe] bg-[#fdfefe] hover:bg-[#f0f9ff]"
                            }`}
                          >
                            {/* Medicine Header Card */}
                            <button
                              onClick={() => handleToggleMedicine(medKey)}
                              className="w-full px-3.5 py-3 flex items-center justify-between text-left cursor-pointer"
                            >
                              <div className="space-y-1">
                                <h4 className="text-xs font-extrabold text-[#073b4c]">
                                  {med.name}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                                  <span className="text-[#0369a1]">Total: {med.totalQty} pcs</span>
                                  <span>•</span>
                                  <span>{med.rxCount} Resep</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[9px] bg-[#e0f2fe] border border-[#bae6fd] text-[#0369a1] font-extrabold px-2 py-0.5 rounded-md shadow-xs">
                                  {med.list.length} Rx
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-[#0369a1]" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-[#0369a1]" />
                                )}
                              </div>
                            </button>

                            {/* Collapsible Medicine Prescription List */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="border-t border-[#bae6fd] px-3.5 py-3 bg-white"
                                >
                                  <div className="text-[9px] font-extrabold text-[#0369a1] uppercase tracking-wider mb-2">
                                    TERCATAT PADA LEMBAR RESEP BERIKUT:
                                  </div>
                                  <div className="space-y-1.5 pb-1">
                                    {med.list.map((rx) => {
                                      // Find specific details of this medicine inside this prescription
                                      const matchingMed = rx.medicines?.find(m => m.nama?.toLowerCase().trim() === med.name.toLowerCase().trim());
                                      const dosageText = matchingMed?.dosis ? `[${matchingMed.dosis}]` : "";
                                      const qtyText = matchingMed?.jumlah ? `${matchingMed.jumlah} pcs` : "";

                                      return (
                                        <div 
                                          key={rx.id}
                                          onClick={() => setSelectedPrescription(rx)}
                                          className="group flex flex-wrap items-center justify-between p-2 rounded-xl hover:bg-[#f0f9ff] border border-[#fdfefe] hover:border-[#bae6fd] cursor-pointer transition-all text-[11px]"
                                        >
                                          <div className="flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5 text-[#0ea5e9] shrink-0" />
                                            <span className="font-mono font-bold text-[#073b4c]">
                                              {rx.prescriptionNo}
                                            </span>
                                            {dosageText && (
                                              <span className="text-[10px] text-slate-400 font-medium">{dosageText}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                            {qtyText && (
                                              <span className="font-extrabold text-[#0ea5e9] bg-[#e0f2fe] border border-[#bae6fd] px-1.5 py-0.5 rounded-sm">{qtyText}</span>
                                            )}
                                            <span className="truncate max-w-[80px] font-semibold text-slate-700" title={`Pasien: ${rx.patientName}`}>{rx.patientName}</span>
                                            <span className="truncate max-w-[80px]" title={`dr. ${rx.doctor}`}>dr. {rx.doctor}</span>
                                            <span className="flex items-center gap-0.5 font-medium shrink-0">
                                              <Calendar className="w-2.5 h-2.5" />
                                              {rx.date}
                                            </span>
                                            <ExternalLink className="w-3 h-3 text-[#0ea5e9]/50 group-hover:text-[#0ea5e9] transition-colors" />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Prescription Detail Modal - CERAH BEACH THEME */}
      <AnimatePresence>
        {selectedPrescription && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#bae6fd] p-5 sm:p-6 rounded-2xl max-w-md w-full shadow-2xl relative flex flex-col gap-4 text-slate-800"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-sky-100 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-extrabold text-[#0ea5e9] uppercase tracking-widest block">Detail Lembar Resep</span>
                  <h3 className="text-sm font-extrabold text-[#073b4c] font-mono">
                    Nomor: {selectedPrescription.prescriptionNo}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedPrescription(null)}
                  className="p-1 rounded-lg hover:bg-sky-50 text-sky-650 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core Info Block */}
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-4 bg-[#f0f9ff] p-3 rounded-xl border border-[#e0f2fe]">
                  <div>
                    <span className="text-[9px] text-[#0369a1] font-bold block uppercase tracking-wider">TANGGAL RESEP</span>
                    <span className="font-bold flex items-center gap-1 mt-0.5 text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-[#0ea5e9]" />
                      {selectedPrescription.date}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#0369a1] font-bold block uppercase tracking-wider">DOKTER PENULIS</span>
                    <span className="font-bold flex items-center gap-1 mt-0.5 text-slate-700 truncate" title={selectedPrescription.doctor}>
                      <Stethoscope className="w-3.5 h-3.5 text-[#0ea5e9]" />
                      dr. {selectedPrescription.doctor}
                    </span>
                  </div>
                </div>

                <div className="bg-[#f0f9ff] p-3 rounded-xl border border-[#e0f2fe] space-y-2">
                  <div>
                    <span className="text-[9px] text-[#0369a1] font-bold block uppercase tracking-wider">NAMA PASIEN</span>
                    <span className="font-bold flex items-center gap-1 mt-0.5 text-slate-700">
                      <User className="w-3.5 h-3.5 text-[#0ea5e9]" />
                      {selectedPrescription.patientName}
                    </span>
                  </div>
                  {selectedPrescription.patientAddress && (
                    <div>
                      <span className="text-[9px] text-[#0369a1] font-bold block uppercase">ALAMAT</span>
                      <span className="text-slate-600 block mt-0.5 break-words">
                        {selectedPrescription.patientAddress}
                      </span>
                    </div>
                  )}
                </div>

                {/* Medicines List inside Modal */}
                <div className="space-y-1.5">
                  <span className="text-[9px] text-[#0369a1] font-bold block uppercase tracking-wider">DAFTAR OBAT RESEP</span>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {selectedPrescription.medicines?.map((m, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-2 bg-[#f0f9ff] rounded-lg border border-[#e0f2fe] text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-700">{m.nama}</span>
                          {m.dosis && (
                            <span className="text-[10px] text-slate-400 ml-1.5 font-medium">({m.dosis})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] bg-[#e0f2fe] text-[#0369a1] font-bold px-1.5 py-0.5 rounded-sm border border-[#bae6fd]">
                            {m.kategori}
                          </span>
                          <span className="font-bold text-[#073b4c]">{m.jumlah} pcs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes if any */}
                {selectedPrescription.notes && (
                  <div className="border-t border-sky-100 pt-2.5">
                    <span className="text-[9px] text-[#0369a1] font-bold block uppercase tracking-wider">CATATAN</span>
                    <p className="text-slate-600 italic text-[11px] mt-0.5 bg-[#f0f9ff] p-2 rounded-lg border border-[#e0f2fe]">
                      "{selectedPrescription.notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Close Button Footer */}
              <div className="mt-2">
                <button
                  onClick={() => setSelectedPrescription(null)}
                  className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer shadow-md transition"
                >
                  Tutup Rincian
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
