import React, { useState, useEffect } from "react";
import { Medicine, Prescription, MEDICINE_CATEGORIES, getCategoryByMedicineName } from "@/src/types";
import { Plus, Trash2, Calendar, FileText, User, Tag, HelpCircle, Save, X, Home } from "lucide-react";

interface PrescriptionFormProps {
  initialData?: Prescription | null;
  onSave: (prescription: Omit<Prescription, "id"> & { id?: string }) => void;
  onCancel: () => void;
}

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
  initialData,
  onSave,
  onCancel
}) => {
  const [date, setDate] = useState<string>("");
  const [doctor, setDoctor] = useState<string>("");
  const [prescriptionNo, setPrescriptionNo] = useState<string>("");
  const [patientName, setPatientName] = useState<string>("");
  const [patientAddress, setPatientAddress] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [medicines, setMedicines] = useState<Medicine[]>([
    { nama: "", kategori: MEDICINE_CATEGORIES[0], dosis: "", jumlah: 10 }
  ]);
  const [errors, setErrors] = useState<string>("");

  // Populate data when editing
  useEffect(() => {
    if (initialData) {
      setDate(initialData.date);
      setDoctor(initialData.doctor || "");
      setPrescriptionNo(initialData.prescriptionNo || "");
      setPatientName(initialData.patientName || "");
      setPatientAddress(initialData.patientAddress || "");
      setNotes(initialData.notes || "");
      setMedicines(initialData.medicines && initialData.medicines.length > 0 
        ? [...initialData.medicines] 
        : [{ nama: "", kategori: MEDICINE_CATEGORIES[0], dosis: "", jumlah: 10 }]
      );
    } else {
      // Set to today's date in local timezone YYYY-MM-DD
      const today = new Date().toISOString().split("T")[0];
      setDate(today);
      setDoctor("");
      setPrescriptionNo("");
      setPatientName("");
      setPatientAddress("");
      setNotes("");
      setMedicines([{ nama: "", kategori: MEDICINE_CATEGORIES[0], dosis: "", jumlah: 10 }]);
    }
  }, [initialData]);

  const handleAddMedicine = () => {
    if (medicines.length >= 20) {
      setErrors("Maksimal 20 obat dalam satu resep.");
      return;
    }
    setMedicines([
      ...medicines,
      { nama: "", kategori: MEDICINE_CATEGORIES[0], dosis: "", jumlah: 10 }
    ]);
  };

  const handleRemoveMedicine = (index: number) => {
    if (medicines.length === 1) {
      setErrors("Resep harus memiliki minimal 1 macam obat.");
      return;
    }
    const updated = medicines.filter((_, i) => i !== index);
    setMedicines(updated);
  };

  const handleMedicineChange = <K extends keyof Medicine>(
    index: number,
    field: K,
    value: Medicine[K]
  ) => {
    const updated = [...medicines];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    
    if (field === "nama" && typeof value === "string") {
      const autoCategory = getCategoryByMedicineName(value);
      if (autoCategory) {
        updated[index].kategori = autoCategory;
      }
    }
    
    setMedicines(updated);
    setErrors(""); // Clear errors on modification
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!date) {
      setErrors("Tanggal resep wajib diisi.");
      return;
    }

    if (!prescriptionNo.trim()) {
      setErrors("Nomor resep wajib diisi.");
      return;
    }

    if (!patientName.trim()) {
      setErrors("Nama pasien wajib diisi.");
      return;
    }

    if (medicines.length === 0) {
      setErrors("Minimal 1 resep obat wajib diisi.");
      return;
    }

    for (let i = 0; i < medicines.length; i++) {
      const med = medicines[i];
      if (!med.nama.trim()) {
        setErrors(`Nama obat pada baris ke-${i + 1} tidak boleh kosong.`);
        return;
      }
      if (med.jumlah <= 0 || isNaN(med.jumlah)) {
        setErrors(`Jumlah obat pada baris ke-${i + 1} harus lebih besar dari 0.`);
        return;
      }
    }

    // Submit
    onSave({
      id: initialData?.id,
      date,
      doctor: doctor.trim(),
      prescriptionNo: prescriptionNo.trim(),
      patientName: patientName.trim(),
      patientAddress: patientAddress.trim(),
      notes: notes.trim(),
      medicines: medicines.map(m => ({
        ...m,
        nama: m.nama.trim(),
        dosis: m.dosis ? m.dosis.trim() : "",
        jumlah: parseFloat(Number(m.jumlah).toFixed(2)) // support up to 2 decimal places
      }))
    });
  };

  return (
    <div id="recipe-form-container" className="bg-[#fdf0d5] ring-2 ring-[#dfd1af] p-6 rounded-2xl max-w-3xl mx-auto shadow-[0_12px_40px_-8px_rgba(0,59,70,0.15)] text-[#003b46]">
      <div className="flex items-center justify-between border-b border-[#dfd1af]/50 pb-4 mb-6">
        <h2 className="text-xl font-extrabold text-[#003b46] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#07575b]" />
          {initialData ? "Ubah Resep Obat" : "Tambah Resep Baru"}
        </h2>
        <button
          id="btn-close-form"
          type="button"
          onClick={onCancel}
          className="text-[#07575b] hover:text-[#003b46] bg-white/50 hover:bg-white p-2 rounded-lg transition overflow-hidden cursor-pointer border border-[#dfd1af]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Prescription, Patient & Doctor Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#003b46] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#07575b]" />
              Nomor Resep *
            </label>
            <input
              id="input-prescription-no"
              type="text"
              placeholder="Contoh: R-3081"
              value={prescriptionNo}
              onChange={(e) => setPrescriptionNo(e.target.value)}
              className="w-full bg-white text-[#003b46] placeholder-slate-400 rounded-xl border border-[#dfd1af] focus:border-[#07575b] focus:ring-1 focus:ring-[#07575b] p-3 text-sm focus:outline-none transition font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#003b46] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#07575b]" />
              Nama Pasien *
            </label>
            <input
              id="input-patient-name"
              type="text"
              placeholder="Contoh: Budi Gunawan"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full bg-white text-[#003b46] placeholder-slate-400 rounded-xl border border-[#dfd1af] focus:border-[#07575b] focus:ring-1 focus:ring-[#07575b] p-3 text-sm focus:outline-none transition font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#003b46] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#07575b]" />
              Tanggal Resep *
            </label>
            <input
              id="input-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white text-[#003b46] rounded-xl border border-[#dfd1af] focus:border-[#07575b] focus:ring-1 focus:ring-[#07575b] p-3 text-xs focus:outline-none transition font-semibold"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#003b46] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#07575b]" />
              Nama Dokter (Opsional)
            </label>
            <input
              id="input-doctor"
              type="text"
              placeholder="Contoh: Dr. Herman"
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              className="w-full bg-white text-[#003b46] placeholder-slate-400 rounded-xl border border-[#dfd1af] focus:border-[#07575b] focus:ring-1 focus:ring-[#07575b] p-3 text-sm focus:outline-none transition font-semibold"
              maxLength={150}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#003b46] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-[#07575b]" />
              Alamat Pasien (Opsional)
            </label>
            <input
              id="input-patient-address"
              type="text"
              placeholder="Contoh: Jl. Merdeka No. 10 (opsional)"
              value={patientAddress}
              onChange={(e) => setPatientAddress(e.target.value)}
              className="w-full bg-white text-[#003b46] placeholder-slate-400 rounded-xl border border-[#dfd1af] focus:border-[#07575b] focus:ring-1 focus:ring-[#07575b] p-3 text-sm focus:outline-none transition font-semibold"
              maxLength={300}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#003b46] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-[#07575b]" />
            Catatan Resep Umum (Opsional)
          </label>
          <input
            id="input-notes"
            type="text"
            placeholder="Contoh: Diminum sesudah makan, habiskan antibiotik"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white text-[#003b46] placeholder-slate-400 rounded-xl border border-[#dfd1af] focus:border-[#07575b] focus:ring-1 focus:ring-[#07575b] p-3 text-sm focus:outline-none transition font-semibold"
            maxLength={500}
          />
        </div>

        {/* Medicines list section */}
        <div className="border-t border-[#dfd1af]/50 pt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#003b46]">
              Daftar Obat Terkandung ({medicines.length})
            </h3>
            <button
              id="btn-add-item"
              type="button"
              onClick={handleAddMedicine}
              className="flex items-center gap-1 bg-[#07575b]/10 hover:bg-[#07575b]/20 text-[#07575b] text-xs py-1.5 px-3 rounded-lg border border-[#07575b]/30 font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Obat Baru
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {medicines.map((med, idx) => (
              <div
                key={idx}
                className="bg-white/80 border border-[#dfd1af] p-4 rounded-xl relative space-y-3"
              >
                {/* Delete cross */}
                <button
                  id={`btn-delete-item-${idx}`}
                  type="button"
                  onClick={() => handleRemoveMedicine(idx)}
                  className="absolute top-3 right-3 text-neutral-400 hover:text-rose-650 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                  title="Hapus obat ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="text-xs font-bold text-[#07575b] uppercase tracking-wider">
                  Obat Macam #{idx + 1}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold tracking-wider text-[#003b46]/70 mb-1">
                      Nama Obat *
                    </label>
                    <input
                      id={`input-med-name-${idx}`}
                      type="text"
                      placeholder="Contoh: Codein 10mg"
                      value={med.nama}
                      onChange={(e) => handleMedicineChange(idx, "nama", e.target.value)}
                      className="w-full bg-white border border-[#dfd1af] rounded-lg p-2.5 text-xs text-[#003b46] focus:border-[#07575b] focus:outline-none font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold tracking-wider text-[#003b46]/70 mb-1">
                      Kategori Obat
                    </label>
                    <select
                      id={`input-med-cat-${idx}`}
                      value={med.kategori}
                      onChange={(e) => handleMedicineChange(idx, "kategori", e.target.value)}
                      className="w-full bg-white border border-[#dfd1af] rounded-lg p-2.5 text-xs text-[#003b46] focus:border-[#07575b] focus:outline-none font-semibold"
                    >
                      {MEDICINE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold tracking-wider text-[#003b46]/70 mb-1">
                      Aturan Dosis (Frekuensi) (Opsional)
                    </label>
                    <input
                      id={`input-med-dose-${idx}`}
                      type="text"
                      placeholder="Contoh: 3 x 1 tablet sehari (opsional)"
                      value={med.dosis || ""}
                      onChange={(e) => handleMedicineChange(idx, "dosis", e.target.value)}
                      className="w-full bg-white border border-[#dfd1af] rounded-lg p-2.5 text-xs text-[#003b46] focus:border-[#07575b] focus:outline-none font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold tracking-wider text-[#003b46]/70 mb-1">
                      Jumlah (Butir/Pcs) *
                    </label>
                    <input
                      id={`input-med-qty-${idx}`}
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={med.jumlah || ""}
                      onChange={(e) => handleMedicineChange(idx, "jumlah", parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-[#dfd1af] rounded-lg p-2.5 text-xs text-[#003b46] focus:border-[#07575b] focus:outline-none font-semibold"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error message show */}
        {errors && (
          <div className="p-3 bg-red-100 border border-red-350 text-red-850 text-xs rounded-xl text-center font-bold">
            {errors}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#dfd1af]/50">
          <button
            id="btn-cancel"
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-[#07575b] hover:text-[#003b46] bg-white hover:bg-neutral-50 rounded-xl transition cursor-pointer border border-[#dfd1af] shadow-xs"
          >
            Batal
          </button>
          <button
            id="btn-save"
            type="submit"
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-[#07575b] hover:bg-[#003b46] text-[#fdf0d5] rounded-xl shadow-md border border-[#003b46]/40 transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {initialData ? "Simpan Perubahan" : "Simpan Resep"}
          </button>
        </div>
      </form>
    </div>
  );
};
