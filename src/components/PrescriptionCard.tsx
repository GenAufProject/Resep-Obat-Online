import React, { useState, useEffect } from "react";
import { Prescription } from "@/src/types";
import { Calendar, User, ClipboardList, PenTool, Trash2, Edit, FileText, Home, Pin } from "lucide-react";

interface PrescriptionCardProps {
  prescription: Prescription;
  onEdit: (prescription: Prescription) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onUpdatePinNotes: (id: string, notes: string) => void;
  isCompact?: boolean;
}

export const PrescriptionCard: React.FC<PrescriptionCardProps> = ({
  prescription,
  onEdit,
  onDelete,
  onTogglePin,
  onUpdatePinNotes,
  isCompact = false
}) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(prescription.pinNotes || "");

  // Sync state if prop changes
  useEffect(() => {
    setTempNotes(prescription.pinNotes || "");
  }, [prescription.pinNotes]);

  const handleSaveNotes = () => {
    onUpdatePinNotes(prescription.id, tempNotes);
    setIsEditingNotes(false);
  };
  // Format Date to Indonesia format (e.g. "14 Juni 2026")
  const formatDateIndonesia = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return dateObj.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      id={`prescription-card-${prescription.id}`}
      className={`transition-all duration-300 hover:scale-[1.012] hover:-translate-y-0.5 relative flex flex-col justify-between border-2 ${
        isCompact ? "p-3.5 rounded-xl space-y-2.5" : "p-5 rounded-2xl space-y-4"
      } ${
        prescription.isPinned 
          ? "border-amber-400 bg-amber-50/15 shadow-[0_8px_30px_-6px_rgba(245,158,11,0.18)] hover:border-amber-500" 
          : "bg-white border-brand-light hover:border-brand-medium shadow-[0_4px_24px_-4px_rgba(0,59,70,0.06)] hover:shadow-[0_12px_40px_-6px_rgba(0,59,70,0.14)]"
      }`}
    >
      {/* Top row Info */}
      <div className={isCompact ? "space-y-2" : "space-y-3"}>
        <div className="flex items-start justify-between gap-2">
          <div className={`w-full ${isCompact ? "space-y-1" : "space-y-1.5"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className={`text-brand-medium font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                isCompact ? "text-[10px]" : "text-xs"
              }`}>
                <Calendar className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                <span>{formatDateIndonesia(prescription.date)}</span>
              </div>
              
              {/* Pin toggling button */}
              <button
                type="button"
                onClick={() => onTogglePin(prescription.id)}
                className={`flex items-center gap-1 font-black uppercase tracking-wider rounded-full border transition cursor-pointer shrink-0 ${
                  isCompact ? "text-[8px] py-0.5 px-1.5" : "text-[10px] py-1 px-2"
                } ${
                  prescription.isPinned
                    ? "bg-amber-400 text-amber-950 border-amber-500 hover:bg-amber-300"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700"
                }`}
                title={prescription.isPinned ? "Lepas sematan resep" : "Sematkan resep ke paling atas"}
              >
                <Pin className={`${isCompact ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} ${prescription.isPinned ? "fill-amber-950 rotate-45" : ""}`} />
                <span>{prescription.isPinned ? "Tersemat" : "Sematkan"}</span>
              </button>
            </div>
            
            <div className="text-[#003b46] font-bold flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">No. Resep:</span>
              <span className={`bg-brand-medium/10 text-brand-medium px-2 py-0.5 rounded-md font-mono font-bold ${
                isCompact ? "text-[10px]" : "text-xs"
              }`}>{prescription.prescriptionNo || "-"}</span>
            </div>

            <div className={`text-[#003b46] flex flex-col ${isCompact ? "pt-0.5" : "pt-1"}`}>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-0.5">Identitas Pasien:</span>
              <div className={`text-[#003b46] font-extrabold flex items-center gap-1 ${
                isCompact ? "text-sm" : "text-base"
              }`}>
                <span>{prescription.patientName || "Bukan Pasien Spesifik"}</span>
              </div>
              
              {prescription.patientAddress && (
                <div className={`text-slate-500 font-medium flex items-center gap-1 mt-1 bg-brand-light/40 rounded-lg border border-brand-light/80 ${
                  isCompact ? "text-[10px] py-0.5 px-2" : "text-xs py-1 px-2"
                }`}>
                  <Home className={`${isCompact ? "w-2.5 h-2.5" : "w-3 h-3"} text-brand-medium shrink-0`} />
                  <span className="truncate">{prescription.patientAddress}</span>
                </div>
              )}
            </div>

            <div className={`text-slate-705 font-bold border-t border-dashed border-[#dfd1af]/50 flex items-center gap-1 ${
              isCompact ? "text-[11px] pt-1.5" : "text-xs pt-2"
            }`}>
              <span className="text-slate-400 text-[10px] uppercase font-extrabold">Dokter:</span>
              <span className="text-brand-medium">{prescription.doctor ? `Dr. ${prescription.doctor}` : "-"}</span>
            </div>
          </div>

          {/* Quantity pill */}
          <span className={`bg-brand-pink/25 text-[#003b46] shrink-0 uppercase tracking-wider font-extrabold rounded-full border border-brand-pink/40 shadow-xs ${
            isCompact ? "text-[9px] px-2 py-1" : "text-[10px] px-3 py-1.5"
          }`}>
            {prescription.medicines.length} Obat
          </span>
        </div>

          {/* Notes (if exists) */}
        {prescription.notes && (
          <div className={`bg-[#fdf0d5]/15 rounded-xl border border-brand-light text-slate-600 leading-relaxed italic flex items-start gap-1.5 ${
            isCompact ? "p-1.5 text-[11px]" : "p-2.5 text-xs"
          }`}>
            <ClipboardList className={`text-brand-medium mt-0.5 shrink-0 ${isCompact ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
            <span>"{prescription.notes}"</span>
          </div>
        )}

        {/* List of medicines */}
        <div className={`border-t border-[#dfd1af]/50 ${isCompact ? "pt-2 space-y-2" : "pt-3.5 space-y-3"}`}>
          <div className="text-[10px] uppercase font-extrabold tracking-wider text-[#003b46]/70">
            Detail Obat Terapi:
          </div>
          <div className={isCompact ? "space-y-1.5" : "space-y-2"}>
            {prescription.medicines.map((med, index) => (
              isCompact ? (
                <div
                  key={index}
                  className="bg-[#fdf0d5]/15 px-2.5 py-1.5 rounded-lg border border-[#dfd1af]/20 flex items-center justify-between gap-1.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[#003b46] font-extrabold block truncate leading-tight" title={med.nama}>{med.nama}</span>
                    <span className="text-[8px] text-pink-600 font-extrabold uppercase tracking-wide bg-brand-pink/15 px-1 py-0.2 rounded inline-block mt-0.5 scale-90 origin-left">
                      {med.kategori}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-brand-medium text-[10px] font-bold block">{med.dosis || "Tanpa dosis"}</span>
                    <span className="text-slate-500 text-[9px] font-black">{med.jumlah} pcs</span>
                  </div>
                </div>
              ) : (
                <div
                  key={index}
                  className="bg-[#fdf0d5]/20 p-2.5 rounded-xl border border-[#dfd1af]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="text-[#003b46] font-extrabold text-sm">
                      {med.nama}
                    </div>
                    <div className="inline-block text-[9px] font-extrabold text-[#003b46] bg-brand-pink/25 border border-brand-pink/35 px-2 py-0.5 rounded-md font-sans">
                      {med.kategori}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                    <div className="text-left sm:text-right">
                      {med.dosis ? (
                        <div className="text-brand-medium text-xs font-bold">
                          {med.dosis}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px] italic">
                          Tanpa dosis khusus
                        </div>
                      )}
                      <div className="text-neutral-500 text-[10px] uppercase font-bold mt-0.5">
                        Jml: {med.jumlah} pcs
                      </div>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </div>

      {/* Pinned Note Section */}
      {prescription.isPinned && (
        <div className={`bg-amber-100/40 rounded-xl border border-amber-300 space-y-2 mt-2 ${
          isCompact ? "p-2.5 space-y-1.5" : "p-3.5 space-y-2"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider flex items-center gap-1">
              <Pin className="w-3 h-3 text-amber-600 fill-amber-600 rotate-45 shrink-0" />
              Catatan Sematan Penting:
            </span>
            {isEditingNotes ? (
              <button
                type="button"
                onClick={handleSaveNotes}
                className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded font-black cursor-pointer transition"
              >
                Simpan
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingNotes(true)}
                className="text-[10px] text-amber-800 hover:underline font-black cursor-pointer transition"
              >
                Edit Catatan
              </button>
            )}
          </div>
          {isEditingNotes ? (
            <textarea
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              placeholder="Tulis catatan penting resep ini..."
              className="w-full text-xs font-semibold text-amber-905 bg-white border border-amber-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans min-h-[60px] resize-y"
            />
          ) : (
            <p className="text-xs font-bold text-amber-950 font-sans leading-relaxed whitespace-pre-wrap">
              {prescription.pinNotes ? prescription.pinNotes : (
                <span className="text-amber-600/70 italic text-[11px]">Belum ada catatan sematan.</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Row operations */}
      <div className={`flex items-center justify-end gap-2 border-t border-[#dfd1af]/40 mt-auto ${
        isCompact ? "pt-2" : "pt-3"
      }`}>
        <button
          id={`btn-edit-${prescription.id}`}
          onClick={() => onEdit(prescription)}
          className={`flex items-center gap-1 bg-white hover:bg-brand-medium/5 text-slate-700 hover:text-[#003b46] font-bold border border-[#dfd1af] hover:border-brand-medium transition cursor-pointer ${
            isCompact ? "px-2 py-1 text-[11px] rounded-md" : "py-1.5 px-3 text-xs rounded-lg"
          }`}
        >
          <Edit className={isCompact ? "w-3 h-3 text-brand-medium" : "w-3.5 h-3.5 text-brand-medium"} />
          Edit
        </button>
        <button
          id={`btn-delete-${prescription.id}`}
          onClick={() => onDelete(prescription.id)}
          className={`flex items-center gap-1 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold border border-[#dfd1af] hover:border-rose-300 transition cursor-pointer ${
            isCompact ? "px-2 py-1 text-[11px] rounded-md" : "py-1.5 px-3 text-xs rounded-lg"
          }`}
        >
          <Trash2 className={isCompact ? "w-3 h-3 text-rose-500" : "w-3.5 h-3.5 text-rose-500"} />
          Hapus
        </button>
      </div>
    </div>
  );
};
