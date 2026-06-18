import React from "react";
import { Prescription } from "@/src/types";
import { Calendar, User, ClipboardList, PenTool, Trash2, Edit, FileText, Home } from "lucide-react";

interface PrescriptionCardProps {
  prescription: Prescription;
  onEdit: (prescription: Prescription) => void;
  onDelete: (id: string) => void;
}

export const PrescriptionCard: React.FC<PrescriptionCardProps> = ({
  prescription,
  onEdit,
  onDelete
}) => {
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
      className="bg-white border-2 border-brand-light p-5 rounded-2xl hover:border-brand-medium transition-all duration-300 hover:scale-[1.015] hover:-translate-y-1 shadow-[0_4px_24px_-4px_rgba(0,59,70,0.06)] hover:shadow-[0_12px_40px_-6px_rgba(0,59,70,0.14)] space-y-4 relative flex flex-col justify-between"
    >
      {/* Top row Info */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 w-full">
            <div className="text-brand-medium text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDateIndonesia(prescription.date)}</span>
            </div>
            
            <div className="text-[#003b46] font-bold text-sm flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">No. Resep:</span>
              <span className="bg-brand-medium/10 text-brand-medium px-2 py-0.5 rounded-md font-mono text-xs font-bold">{prescription.prescriptionNo || "-"}</span>
            </div>

            <div className="text-slate-800 font-bold text-base flex flex-col pt-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Identitas Pasien:</span>
              <div className="text-[#003b46] font-extrabold text-base flex items-center gap-1">
                <span>{prescription.patientName || "Bukan Pasien Spesifik"}</span>
              </div>
              
              {prescription.patientAddress && (
                <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1 bg-brand-light/40 py-1 px-2 rounded-lg border border-brand-light/80">
                  <Home className="w-3 h-3 text-brand-medium shrink-0" />
                  <span className="truncate">{prescription.patientAddress}</span>
                </div>
              )}
            </div>

            <div className="text-slate-705 text-xs font-bold pt-2 border-t border-dashed border-[#dfd1af]/50 flex items-center gap-1">
              <span className="text-slate-400 text-[10px] uppercase font-extrabold">Dokter:</span>
              <span className="text-brand-medium">{prescription.doctor ? `Dr. ${prescription.doctor}` : "-"}</span>
            </div>
          </div>

          {/* Quantity pill */}
          <span className="bg-brand-pink/25 text-[#003b46] shrink-0 text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full border border-brand-pink/40 shadow-xs">
            {prescription.medicines.length} Obat
          </span>
        </div>

        {/* Notes (if exists) */}
        {prescription.notes && (
          <div className="bg-[#fdf0d5]/15 p-2.5 rounded-xl border border-brand-light text-slate-600 text-xs leading-relaxed italic flex items-start gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-brand-medium mt-0.5 shrink-0" />
            <span>"{prescription.notes}"</span>
          </div>
        )}

        {/* List of medicines */}
        <div className="border-t border-[#dfd1af]/50 pt-3.5 space-y-3">
          <div className="text-[10px] uppercase font-extrabold tracking-wider text-[#003b46]/70">
            Detail Obat Terapi:
          </div>
          <div className="space-y-2">
            {prescription.medicines.map((med, index) => (
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
            ))}
          </div>
        </div>
      </div>

      {/* Row operations */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#dfd1af]/40 mt-auto">
        <button
          id={`btn-edit-${prescription.id}`}
          onClick={() => onEdit(prescription)}
          className="flex items-center gap-1 bg-white hover:bg-brand-medium/5 text-slate-700 hover:text-[#003b46] text-xs font-bold py-1.5 px-3 rounded-lg border border-[#dfd1af] hover:border-brand-medium transition cursor-pointer"
        >
          <Edit className="w-3.5 h-3.5 text-brand-medium" />
          Edit
        </button>
        <button
          id={`btn-delete-${prescription.id}`}
          onClick={() => onDelete(prescription.id)}
          className="flex items-center gap-1 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-bold py-1.5 px-3 rounded-lg border border-[#dfd1af] hover:border-rose-300 transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          Hapus
        </button>
      </div>
    </div>
  );
};
