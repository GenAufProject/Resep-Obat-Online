import React, { useState, useEffect, useMemo } from "react";
import { 
  PioKieRecord, 
  generatePioKieNumber 
} from "../types";
import { exportPioKieRecordToPDF } from "../utils/exportPioKie";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  FileText, 
  Calendar, 
  User, 
  Phone, 
  Video, 
  Sparkles, 
  Info, 
  Download, 
  Undo2, 
  Bookmark, 
  ShieldCheck, 
  Briefcase 
} from "lucide-react";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, user: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface PioKieManagerProps {
  user: any;
  db: any;
  isFirebaseReady: boolean;
  setCustomAlert: (alert: { type: "success" | "error" | "info"; title: string; message: string } | null) => void;
}

export function PioKieManager({ user, db, isFirebaseReady, setCustomAlert }: PioKieManagerProps) {
  const [records, setRecords] = useState<PioKieRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<PioKieRecord | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterJenis, setFilterJenis] = useState<"Semua" | "PIO" | "KIE">("Semua");

  // Form Fields State
  const [jenisDokumentasi, setJenisDokumentasi] = useState<"PIO" | "KIE">("PIO");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [namaPasien, setNamaPasien] = useState<string>("");
  const [umur, setUmur] = useState<string>("");
  const [beratBadan, setBeratBadan] = useState<string>("");
  const [jenisKelamin, setJenisKelamin] = useState<"Laki-laki" | "Perempuan">("Laki-laki");
  const [hamilMenyusui, setHamilMenyusui] = useState<string>("");
  const [riwayatAlergi, setRiwayatAlergi] = useState<string>("");
  const [keluhanPertanyaan, setKeluhanPertanyaan] = useState<string>("");
  const [jawabanTindakLanjut, setJawabanTindakLanjut] = useState<string>("");
  const [referensi, setReferensi] = useState<string>("");
  const [metode, setMetode] = useState<"Tatap Muka" | "Telepon" | "Video Call">("Tatap Muka");
  const [namaApoteker, setNamaApoteker] = useState<string>(localStorage.getItem("last_active_apoteker") || "");

  // Delete Prompt
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  // Subscribing to PIO/KIE Firestore or loading from LocalStorage
  useEffect(() => {
    if (isFirebaseReady && db && user && user.uid !== "guest_user") {
      setLoading(true);
      const q = query(
        collection(db, "pio_kie"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: PioKieRecord[] = [];
          snapshot.forEach((docSnap) => {
            list.push({
              id: docSnap.id,
              ...(docSnap.data() as Omit<PioKieRecord, "id">)
            });
          });
          // Sort by date descending
          list.sort((a, b) => b.date.localeCompare(a.date));
          setRecords(list);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore read error for pio_kie:", error);
          // Fallback to local storage if firestore permission denied or failing
          loadFromLocal();
          setLoading(false);
          handleFirestoreError(error, OperationType.LIST, "pio_kie", user);
        }
      );
      return () => unsubscribe();
    } else {
      loadFromLocal();
    }
  }, [user, db, isFirebaseReady]);

  const loadFromLocal = () => {
    const localStr = localStorage.getItem("rekap_pio_kie");
    if (localStr) {
      try {
        const list = JSON.parse(localStr) as PioKieRecord[];
        list.sort((a, b) => b.date.localeCompare(a.date));
        setRecords(list);
      } catch (err) {
        console.error("Failed to load local pio_kie:", err);
      }
    }
  };

  const saveToLocal = (updatedList: PioKieRecord[]) => {
    localStorage.setItem("rekap_pio_kie", JSON.stringify(updatedList));
    setRecords(updatedList);
  };

  // Live Auto-Generated documentation number preview
  const previewDocNumber = useMemo(() => {
    // Exclude currently editing item from existing records when computing the serial code sequence
    const listForSequenceSequence = editingRecord 
      ? records.filter(r => r.id !== editingRecord.id) 
      : records;
    return generatePioKieNumber(jenisDokumentasi, date, listForSequenceSequence);
  }, [jenisDokumentasi, date, records, editingRecord]);

  // Handle trigger new record form
  const handleOpenNewForm = () => {
    setEditingRecord(null);
    setJenisDokumentasi("PIO");
    setDate(new Date().toISOString().split("T")[0]);
    setNamaPasien("");
    setUmur("");
    setBeratBadan("");
    setJenisKelamin("Laki-laki");
    setHamilMenyusui("");
    setRiwayatAlergi("");
    setKeluhanPertanyaan("");
    setJawabanTindakLanjut("");
    setReferensi("");
    setMetode("Tatap Muka");
    setNamaApoteker(localStorage.getItem("last_active_apoteker") || "");
    setIsFormOpen(true);
  };

  // Handle trigger edit record form
  const handleOpenEditForm = (rec: PioKieRecord) => {
    setEditingRecord(rec);
    setJenisDokumentasi(rec.jenisDokumentasi);
    setDate(rec.date);
    setNamaPasien(rec.namaPasien);
    setUmur(rec.umur || "");
    setBeratBadan(rec.beratBadan || "");
    setJenisKelamin(rec.jenisKelamin);
    setHamilMenyusui(rec.hamilMenyusui || "");
    setRiwayatAlergi(rec.riwayatAlergi || "");
    setKeluhanPertanyaan(rec.keluhanPertanyaan);
    setJawabanTindakLanjut(rec.jawabanTindakLanjut);
    setReferensi(rec.referensi || "");
    setMetode(rec.metode);
    setNamaApoteker(rec.namaApoteker);
    setIsFormOpen(true);
  };

  // Handle form submission
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!namaPasien.trim()) {
      setCustomAlert({
        type: "error",
        title: "Nama Pasien Kosong",
        message: "Silakan masukkan nama pasien terlebih dahulu."
      });
      return;
    }

    if (!keluhanPertanyaan.trim()) {
      setCustomAlert({
        type: "error",
        title: "Pertanyaan Kosong",
        message: "Silakan isi kolom keluhan atau pertanyaan konseling pasien."
      });
      return;
    }

    if (!jawabanTindakLanjut.trim()) {
      setCustomAlert({
        type: "error",
        title: "Tindak Lanjut Kosong",
        message: "Silakan isi catatan jawaban obat atau tindak lanjut edukasi apoteker."
      });
      return;
    }

    if (!namaApoteker.trim()) {
      setCustomAlert({
        type: "error",
        title: "Apoteker Tidak Terdaftar",
        message: "Silakan isi nama Apoteker yang memproses pelayanan KIE/PIO ini."
      });
      return;
    }

    // Save active apoteker as default preference for next entry flow
    localStorage.setItem("last_active_apoteker", namaApoteker.trim());

    const docId = editingRecord?.id || "pio_kie_" + Date.now().toString() + "_" + Math.random().toString(36).substr(2, 5);

    const dataObj: Omit<PioKieRecord, "id"> = {
      nomorDokumentasi: previewDocNumber,
      jenisDokumentasi,
      date,
      namaPasien: namaPasien.trim(),
      umur: umur.trim(),
      beratBadan: beratBadan.trim(),
      jenisKelamin,
      hamilMenyusui: hamilMenyusui.trim(),
      riwayatAlergi: riwayatAlergi.trim(),
      keluhanPertanyaan: keluhanPertanyaan.trim(),
      jawabanTindakLanjut: jawabanTindakLanjut.trim(),
      referensi: referensi.trim(),
      metode,
      namaApoteker: namaApoteker.trim()
    };

    try {
      if (isFirebaseReady && db && user && user.uid !== "guest_user") {
        setLoading(true);
        const docRef = doc(db, "pio_kie", docId);
        try {
          await setDoc(docRef, {
            ...dataObj,
            userId: user.uid,
            updatedAt: serverTimestamp(),
            createdAt: editingRecord?.createdAt || serverTimestamp()
          }, { merge: true });
        } catch (dbErr) {
          handleFirestoreError(dbErr, editingRecord ? OperationType.UPDATE : OperationType.CREATE, `pio_kie/${docId}`, user);
        }
        
        setCustomAlert({
          type: "success",
          title: "Berhasil Disimpan",
          message: `Dokumentasi KIE/PIO ${previewDocNumber} berhasil disimpan di Cloud secara real-time!`
        });
      } else {
        // Local path
        const updatedRecords = [...records];
        if (editingRecord) {
          const index = updatedRecords.findIndex(r => r.id === editingRecord.id);
          if (index !== -1) {
            updatedRecords[index] = { id: docId, ...dataObj, createdAt: editingRecord.createdAt };
          }
        } else {
          updatedRecords.unshift({ id: docId, ...dataObj, createdAt: new Date().toISOString() });
        }
        saveToLocal(updatedRecords);
        setCustomAlert({
          type: "success",
          title: "Sesi Lokal Tersimpan",
          message: `Dokumentasi ${previewDocNumber} disimpan di penyimpanan lokal browser.`
        });
      }

      setIsFormOpen(false);
      setEditingRecord(null);
    } catch (err: any) {
      console.error("Failed storing PIO/KIE data:", err);
      setCustomAlert({
        type: "error",
        title: "Penyimpanan Gagal",
        message: "Gagal menyimpan rekam dokumentasi KIE/PIO: " + (err.message || err)
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete Action executor
  const handleDeleteRecord = async (id: string) => {
    try {
      if (isFirebaseReady && db && user && user.uid !== "guest_user") {
        setLoading(true);
        try {
          await deleteDoc(doc(db, "pio_kie", id));
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.DELETE, `pio_kie/${id}`, user);
        }
        setCustomAlert({
          type: "success",
          title: "Aset Laporan Dihapus",
          message: "Dokumentasi pelayanan farmasi berhasil dihapus dari Cloud."
        });
      } else {
        const remaining = records.filter(r => r.id !== id);
        saveToLocal(remaining);
        setCustomAlert({
          type: "success",
          title: "Berhasil Terhapus",
          message: "Dokumentasi pelayanan berhasil dihapus dari komputer lokal Anda."
        });
      }
      setRecordToDelete(null);
    } catch (err: any) {
      console.error("Deletion failed:", err);
      setCustomAlert({
        type: "error",
        title: "Gagal Menghapus",
        message: "Kesalahan internal Firestore: " + (err.message || err)
      });
    } finally {
      setLoading(false);
    }
  };

  // Filters logic
  const filteredList = useMemo(() => {
    return records.filter(r => {
      if (filterJenis !== "Semua" && r.jenisDokumentasi !== filterJenis) {
        return false;
      }
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const numMatch = (r.nomorDokumentasi || "").toLowerCase().includes(queryLower);
        const nameMatch = (r.namaPasien || "").toLowerCase().includes(queryLower);
        const questionMatch = (r.keluhanPertanyaan || "").toLowerCase().includes(queryLower);
        const answerMatch = (r.jawabanTindakLanjut || "").toLowerCase().includes(queryLower);
        const apoMatch = (r.namaApoteker || "").toLowerCase().includes(queryLower);
        return numMatch || nameMatch || questionMatch || answerMatch || apoMatch;
      }
      return true;
    });
  }, [records, filterJenis, searchQuery]);

  return (
    <div id="pio-kie-workspace" className="space-y-6">
      
      {/* Intro section banner */}
      <div className="bg-gradient-to-r from-[#07575b] to-[#3b7a6b] text-white p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span>Pelayanan Informasi Obat (PIO) & Konseling (KIE)</span>
          </h2>
          <p className="text-xs text-teal-100 max-w-2xl">
            Modul rekap konseling pasien dan Pelayanan Informasi Obat (PIO/KIE) kefarmasian. 
            Sesuai standar pelayanan kefarmasian di Apotek untuk asuhan pengobatan optimal bagi pasien.
          </p>
        </div>
        {!isFormOpen && (
          <button
            id="btn-trigger-new-pio-kie"
            onClick={handleOpenNewForm}
            className="self-start sm:self-auto bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-black px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm border-none"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Input PIO / KIE</span>
          </button>
        )}
      </div>

      {isFormOpen ? (
        /* Form Card */
        <div id="pio-kie-form-card" className="bg-white border border-[#e6ece7] p-6 sm:p-8 rounded-2xl shadow-md max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-teal-50 text-[#07575b] p-2 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  {editingRecord ? "Ubah Dokumentasi Pelayanan" : "Dokumentasi Baru Pelayanan Kefarmasian"}
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold">Lengkapi data asuhan kefarmasian di bawah secara akurat</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setIsFormOpen(false);
                setEditingRecord(null);
              }}
              className="text-xs font-extrabold text-[#07575b] uppercase hover:underline cursor-pointer flex items-center gap-1"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Kembali
            </button>
          </div>

          <form onSubmit={handleSaveForm} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Jenis Dokumentasi */}
              <div>
                <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  Jenis Dokumentasi <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center justify-center p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${
                    jenisDokumentasi === "PIO" 
                      ? "bg-teal-50 border-[#8fc8be] text-[#07575b]" 
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                    <input 
                      type="radio" 
                      name="jenisDokumentasi" 
                      value="PIO" 
                      checked={jenisDokumentasi === "PIO"}
                      onChange={() => setJenisDokumentasi("PIO")}
                      className="sr-only" 
                    />
                    <span>Pelayanan Informasi Obat (PIO)</span>
                  </label>
                  
                  <label className={`flex-1 flex items-center justify-center p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${
                    jenisDokumentasi === "KIE" 
                      ? "bg-teal-50 border-[#8fc8be] text-[#07575b]" 
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                    <input 
                      type="radio" 
                      name="jenisDokumentasi" 
                      value="KIE" 
                      checked={jenisDokumentasi === "KIE"}
                      onChange={() => setJenisDokumentasi("KIE")}
                      className="sr-only" 
                    />
                    <span>Konseling Pasien (KIE)</span>
                  </label>
                </div>
              </div>

              {/* Tanggal Input */}
              <div>
                <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  Tanggal Pelayanan <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] p-3 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Auto Generated Number Preview */}
              <div>
                <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  Nomor Dokumentasi (Otomatis)
                </label>
                <div className="bg-[#f0f6f3] border-2 border-dashed border-[#bcd8c8] text-[#003b46] p-3 rounded-xl text-xs font-extrabold flex items-center justify-between shadow-xs">
                  <span>Code:</span>
                  <span className="font-mono text-[13px] text-[#07575b] select-all bg-white px-2 py-0.5 rounded-md border border-[#bcd8c8]">
                    {previewDocNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* Patients details */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                <User className="w-4 h-4 text-[#3b7a6b]" />
                <span>INFORMASI DATA PASIEN</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Patient Name */}
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1">
                    Nama Pasien <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Lengkap Pasien"
                    value={namaPasien}
                    onChange={(e) => setNamaPasien(e.target.value)}
                    required
                    className="w-full bg-white rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1"
                  />
                </div>

                {/* Patient Age */}
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1">
                    Umur (Tahun - Opsional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 45"
                    value={umur}
                    onChange={(e) => setUmur(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1"
                  />
                </div>

                {/* Patient Weight */}
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1">
                    Berat Badan (kg - Opsional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 68"
                    value={beratBadan}
                    onChange={(e) => setBeratBadan(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1"
                  />
                </div>

                {/* Gender selection */}
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1">
                    Jenis Kelamin <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setJenisKelamin("Laki-laki")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                        jenisKelamin === "Laki-laki" 
                          ? "bg-sky-50 border-sky-350 text-sky-700 font-extrabold" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Laki-laki
                    </button>
                    <button
                      type="button"
                      onClick={() => setJenisKelamin("Perempuan")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                        jenisKelamin === "Perempuan" 
                          ? "bg-rose-50 border-rose-350 text-rose-700 font-extrabold" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Perempuan
                    </button>
                  </div>
                </div>

                {/* Hamil atau Menyusui Check */}
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1">
                    Kondisi Khusus (Hamil/Menyusui - Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hamil trimester II, Menyusui bayi 6 bln, t.ada"
                    value={hamilMenyusui}
                    onChange={(e) => setHamilMenyusui(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1"
                  />
                </div>

                {/* Allergy history */}
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 mb-1">
                    Riwayat Alergi Obat / Makanan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alergi Penisilin, t.ada"
                    value={riwayatAlergi}
                    onChange={(e) => setRiwayatAlergi(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1"
                  />
                </div>
              </div>
            </div>

            {/* Spacious Inputs for Consultation Body */}
            <div className="space-y-4">
              {/* Question Input */}
              <div className="space-y-1">
                <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-500">
                  Pertanyaan Pasien atau Keluhan Pengobatan <span className="text-rose-500">*</span>
                </label>
                <p className="text-[10px] text-slate-400 font-medium">Contoh: Pasien menanyakan interaksi penggunaan obat Clopidogrel dan Omeprazole secara bersamaan atau keluhan efek samping obat.</p>
                <textarea
                  rows={4}
                  placeholder="Tuliskan keluhan pengobatan, diagnosa, atau pertanyaan spesifik yang ingin dijawab dari interaksi obat/PIO pasien..."
                  value={keluhanPertanyaan}
                  onChange={(e) => setKeluhanPertanyaan(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl border border-[#e2eae4] p-3 text-xs leading-relaxed text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be] font-mono"
                />
              </div>

              {/* Answer / Followup Input */}
              <div className="space-y-1">
                <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-500">
                  Jawaban Apoteker & Edukasi Tindak Lanjut <span className="text-rose-500">*</span>
                </label>
                <p className="text-[10px] text-slate-400 font-medium">Contoh: Sarankan jeda konsumsi 2-4 jam atau ganti Omeprazole dengan Lansoprazole untuk meminimalisir penurunan efektivitas Clopidogrel.</p>
                <textarea
                  rows={5}
                  placeholder="Isikan catatan komunikasi informasi asuhan medis, rekomendasi penggantian sediaan, solusi tindak lanjut asuhan, dan petunjuk penggunaan aman..."
                  value={jawabanTindakLanjut}
                  onChange={(e) => setJawabanTindakLanjut(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl border border-[#e2eae4] p-3 text-xs leading-relaxed text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be] font-mono"
                />
              </div>
            </div>

            {/* Methods & References */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Service Method */}
              <div>
                <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  Metode Pelayanan <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { id: "Tatap Muka", label: "Tatap Muka", icon: User },
                    { id: "Telepon", label: "Telepon", icon: Phone },
                    { id: "Video Call", label: "Video Call", icon: Video }
                  ].map((elem) => {
                    const IconComp = elem.icon;
                    return (
                      <button
                        key={elem.id}
                        type="button"
                        onClick={() => setMetode(elem.id as any)}
                        className={`flex-1 py-3 px-1 rounded-xl text-xs font-bold border transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                          metode === elem.id 
                            ? "bg-teal-50 border-[#8fc8be] text-[#07575b]" 
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{elem.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  Referensi / Literatur Acuan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. MIMS 2026, BNF 84, PMK No. 73 2016"
                  value={referensi}
                  onChange={(e) => setReferensi(e.target.value)}
                  className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] p-3 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
                />
              </div>

              {/* Pharmacist name (Stamp / TTD) */}
              <div>
                <label className="block text-[11px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                  Nama Apoteker Pelaksana (TTD / Stamp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. apt. Ahmad Fauzan, S.Farm"
                  value={namaApoteker}
                  onChange={(e) => setNamaApoteker(e.target.value)}
                  required
                  className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] p-3 text-xs text-slate-800 font-extrabold focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
                />
              </div>
            </div>

            {/* Action buttons inside form */}
            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingRecord(null);
                }}
                className="px-5 py-2.5 bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#07575b] hover:bg-[#07575b]/90 text-white rounded-xl text-xs font-black shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Memproses..." : editingRecord ? "Simpan Perubahan" : "Simpan Arsip Dokumentasi"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* List / Dashboard View */
        <div id="pio-kie-dashboard" className="space-y-6">
          
          {/* Filtering Widgets */}
          <div className="bg-white border border-[#e6ece7] p-4 rounded-xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Left filtration pills */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border">
              {(["Semua", "PIO", "KIE"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterJenis(tab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterJenis === tab 
                      ? "bg-[#8fc8be] text-slate-900 border border-[#7db9af]/35 shadow-xs" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab === "Semua" ? "Semua Layanan" : tab === "PIO" ? "PIO Saja" : "Konseling (KIE)"}
                </button>
              ))}
            </div>

            {/* Search string */}
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Cari Code / Pasien / Apoteker / Keluhan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] py-2 pl-8 pr-3 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 gap-1" />
            </div>
          </div>

          {/* List display */}
          {filteredList.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredList.map((rec) => {
                const formattedDate = new Date(rec.date).toLocaleDateString("id-ID", {
                  year: "numeric",
                  month: "short",
                  day: "numeric"
                });
                
                return (
                  <div 
                    key={rec.id} 
                    className="bg-white border border-[#e6ece7] rounded-2xl hover:border-[#bfdccd] p-5 sm:p-6 transition shadow-xs hover:shadow-md flex flex-col justify-between gap-4 relative overflow-hidden"
                  >
                    {/* Visual decor line */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${rec.jenisDokumentasi === "PIO" ? "bg-amber-500" : "bg-[#07575b]"}`}></div>

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-slate-50">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 border px-2.5 py-1 rounded-md">
                          {rec.nomorDokumentasi}
                        </span>
                        <span className={`text-[9px] uppercase font-bold py-0.5 px-2.5 rounded-full border ${
                          rec.jenisDokumentasi === "PIO"
                            ? "bg-amber-50 border-amber-200 text-amber-700" 
                            : "bg-teal-50 border-teal-200 text-[#07575b]"
                        }`}>
                          {rec.jenisDokumentasi === "PIO" ? "PJ Pelayanan Informasi" : "PJ Konseling / KIE"}
                        </span>
                        <span className="text-slate-400 text-xs flex items-center gap-1 font-semibold">
                          <Calendar className="w-3.5 h-3.5" />
                          {formattedDate}
                        </span>
                      </div>

                      {/* Control actions */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {/* Download PDF button */}
                        <button
                          onClick={() => exportPioKieRecordToPDF(rec)}
                          className="p-1 px-2.5 bg-teal-50 hover:bg-teal-100 text-[#07575b] rounded-lg border border-teal-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Ekspor dokumen 1 halaman PDF"
                        >
                          <Download className="w-3 h-3 text-rose-600" />
                          <span>PDF</span>
                        </button>
                        
                        <button
                          onClick={() => handleOpenEditForm(rec)}
                          className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 text-xs transition cursor-pointer"
                          title="Edit rekam pelayanan"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => setRecordToDelete(rec.id)}
                          className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded-lg border border-slate-200 text-xs transition cursor-pointer"
                          title="Hapus dokumentasi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata body */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                      {/* Left side Patient information */}
                      <div className="md:col-span-4 bg-[#f8fbfa] rounded-xl p-3 border border-[#eff5f2] space-y-2 text-[#003b46]">
                        <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500 pb-1 border-b">
                          Profil Penerima Komunikasi
                        </div>
                        <div className="font-bold flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-800">{rec.namaPasien}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-semibold text-slate-600">
                          <span>Kelamin:</span>
                          <span className="text-slate-800">{rec.jenisKelamin}</span>
                          
                          <span>Umur / BB:</span>
                          <span className="text-slate-800">
                            {rec.umur ? `${rec.umur} Th` : "-"} / {rec.beratBadan ? `${rec.beratBadan} kg` : "-"}
                          </span>

                          <span>Alergi:</span>
                          <span className="text-rose-700 line-clamp-1" title={rec.riwayatAlergi}>
                            {rec.riwayatAlergi || "tidak ada"}
                          </span>
                        </div>
                      </div>

                      {/* Right side consultation notes summary */}
                      <div className="md:col-span-8 space-y-3">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-700 flex items-center gap-1 uppercase text-[10px] tracking-wide">
                            <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                            <span>Pertanyaan / Keluhan:</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed font-mono line-clamp-2 bg-slate-50 p-2 rounded-lg border">
                            {rec.keluhanPertanyaan}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="font-bold text-slate-700 flex items-center gap-1 uppercase text-[10px] tracking-wide">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#07575b]" />
                            <span>Edukasi & Jawaban Apoteker:</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed font-mono line-clamp-2 bg-[#f4fbf8] p-2 rounded-lg border border-teal-50">
                            {rec.jawabanTindakLanjut}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Small Footer bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-[10px] text-slate-500 font-bold">
                      <div className="flex items-center gap-3">
                        <span className="bg-slate-50 px-2 py-0.5 rounded border">
                          Metode: <strong className="text-slate-800">{rec.metode}</strong>
                        </span>
                        {rec.referensi && (
                          <span className="flex items-center gap-1">
                            <Info className="w-3 h-3 text-[#07575b]" />
                            Acuan: <strong className="text-[#07575b]">{rec.referensi}</strong>
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Briefcase className="w-3.5 h-3.5 text-[#3b7a6b]" />
                        <span>Konselor: <strong className="text-slate-800">{rec.namaApoteker}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty state for search/empty */
            <div className="bg-white border border-[#e6ece7] p-12 rounded-2xl text-center space-y-4 max-w-xl mx-auto shadow-sm">
              <div className="w-16 h-16 bg-[#fafbfa] rounded-full flex items-center justify-between mx-auto border border-[#effed4]">
                <FileText className="w-7 h-7 text-slate-400 mx-auto" />
              </div>
              <div className="space-y-1">
                <h3 className="text-slate-800 font-bold text-lg">Tidak Ada Dokumentasi</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {records.length === 0 
                    ? "Arsip KIE dan PIO saat ini masih kosong. Lengkapi asuhan pengobatan dan kefarmasian Anda dengan menginput konsultasi pertama."
                    : "Tidak ada data pelayanan KIE atau PIO yang sesuai dengan kriteria pencarian Anda."}
                </p>
              </div>
              {records.length > 0 ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterJenis("Semua");
                  }}
                  className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition shadow-sm"
                >
                  Reset Filter Saring
                </button>
              ) : (
                <button
                  onClick={handleOpenNewForm}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-900 border-none font-black px-4 py-2.5 rounded-xl text-xs cursor-pointer shadow-sm"
                >
                  Mulai Input Dokumentasi KIE/PIO
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 bg-brand-dark/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#fdf0d5] ring-2 ring-[#dfd1af] p-6 rounded-2xl max-w-sm w-full shadow-2xl relative flex flex-col gap-4 text-[#003b46]">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-full shrink-0 border border-rose-100">
                <Info className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-left border-none">
                <h3 className="font-extrabold text-sm text-[#003b46] tracking-tight uppercase">Hapus Dokumentasi</h3>
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                  Apakah Anda yakin ingin menghapus dokumentasi KIE/PIO ini? Data arsip ini akan dihapus secara permanen.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#dfd1af]/30">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 bg-white text-[#07575b] border border-[#dfd1af] rounded-xl text-xs font-bold transition hover:bg-neutral-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRecord(recordToDelete)}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition shadow-sm cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
