import React, { useState, useEffect, useMemo } from "react";
import { 
  db, 
  auth, 
  isFirebaseConfigured, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { Prescription, Medicine, MEDICINE_CATEGORIES } from "./types";
import { exportToPDF, exportToExcel } from "./utils/export";
import { SyncBanner } from "./components/SyncBanner";
import { PrescriptionForm } from "./components/PrescriptionForm";
import { PrescriptionCard } from "./components/PrescriptionCard";
import { MonthlyAnalytics } from "./components/MonthlyAnalytics";
import { MonthlyReport } from "./components/MonthlyReport";
import { LoginForm } from "./components/LoginForm";
import { DynamicCapsuleIcon } from "./components/DynamicCapsuleIcon";
import { 
  Plus, 
  Search, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Filter, 
  Calendar, 
  Sparkles, 
  AlertCircle, 
  HelpCircle, 
  BookOpen, 
  Activity, 
  CheckCircle2, 
  RefreshCw,
  FolderSync,
  Upload
} from "lucide-react";

export default function App() {
  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Core prescription state
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [dbLoading, setDbLoading] = useState<boolean>(false);

  // UI state managers
  const [activeTab, setActiveTab] = useState<"daftar" | "grafik" | "laporan" | "panduan">("daftar");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editPrescription, setEditPrescription] = useState<Prescription | null>(null);

  // Search & Filter state
  const [searchDate, setSearchDate] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>(""); // for searching doctor/medicine name
  const [pageSize, setPageSize] = useState<number | "Semua">(20);

  // Merge modal trigger for unsynced local data
  const [localPrescriptionsCount, setLocalPrescriptionsCount] = useState<number>(0);
  const [showMergePrompt, setShowMergePrompt] = useState<boolean>(false);

  // Custom Iframe-Safe Modals & Notifications
  const [prescriptionIdToDelete, setPrescriptionIdToDelete] = useState<string | null>(null);
  const [customAlert, setCustomAlert] = useState<{ type: "success" | "error" | "info"; title: string; message: string } | null>(null);

  // 1. Initial mounting & authentication subscriber setup
  useEffect(() => {
    // Standard quick load from local storage to prevent any screen flash
    const local = localStorage.getItem("rekap_resep_lokal");
    if (local) {
      try {
        const parsed = JSON.parse(local) as Prescription[];
        // Filter out and effectively delete any local prescription data outside of the 5 categories
        const filtered = parsed.filter(p => p.medicines && p.medicines.every(m => m.kategori && MEDICINE_CATEGORIES.includes(m.kategori)));
        setPrescriptions(filtered);
        setLocalPrescriptionsCount(filtered.length);
        if (filtered.length !== parsed.length) {
          localStorage.setItem("rekap_resep_lokal", JSON.stringify(filtered));
        }
      } catch (err) {
        console.error("Failed to parse local storage fallback:", err);
      }
    }

    if (!isFirebaseConfigured || !auth) {
      const localGuest = localStorage.getItem("rekap_guest_session");
      if (localGuest) {
        setUser({ uid: "guest_user", email: "guest@offline.com" } as any);
      }
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        localStorage.removeItem("rekap_guest_session");
      } else {
        const localGuest = localStorage.getItem("rekap_guest_session");
        if (localGuest) {
          setUser({ uid: "guest_user", email: "guest@offline.com" } as any);
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);

      if (currentUser) {
        // Authenticated! Check if we have unmerged local items to offer syncing
        const localData = localStorage.getItem("rekap_resep_lokal");
        if (localData) {
          try {
            const parsed = JSON.parse(localData) as Prescription[];
            if (parsed.length > 0) {
              setLocalPrescriptionsCount(parsed.length);
              setShowMergePrompt(true);
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Database subscription when Auth State is ready
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !user || user.uid === "guest_user" || user.uid === "guest_simulated") {
      // If user logs out or is guest, go back to reading client-only local storage
      const local = localStorage.getItem("rekap_resep_lokal");
      if (local) {
        try {
          const parsed = JSON.parse(local) as Prescription[];
          const filtered = parsed.filter(p => p.medicines && p.medicines.every(m => m.kategori && MEDICINE_CATEGORIES.includes(m.kategori)));
          setPrescriptions(filtered);
          if (filtered.length !== parsed.length) {
            localStorage.setItem("rekap_resep_lokal", JSON.stringify(filtered));
          }
        } catch {
          setPrescriptions([]);
        }
      } else {
        setPrescriptions([]);
      }
      return;
    }

    setDbLoading(true);
    // Subscribe to current authenticated user's prescriptions
    const pathRef = "prescriptions";
    const q = query(
      collection(db, pathRef),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Prescription[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Prescription, "id">)
          });
        });
        
        // Filter out and clean up any prescriptions outside the 5 categories
        const validList = fetched.filter(p => p.medicines && p.medicines.every(m => m.kategori && MEDICINE_CATEGORIES.includes(m.kategori)));
        const invalidList = fetched.filter(p => !p.medicines || p.medicines.some(m => !m.kategori || !MEDICINE_CATEGORIES.includes(m.kategori)));
        
        // Sort client-side by date descending to completely bypass composite index requirements
        validList.sort((a, b) => b.date.localeCompare(a.date));
        
        setPrescriptions(validList);
        
        // Cache in localStorage too so it's fully accessible when offline
        localStorage.setItem(`rekap_resep_cloud_${user.uid}`, JSON.stringify(validList));
        setDbLoading(false);

        // Actively delete invalid real-time collections from Firestore
        if (invalidList.length > 0) {
          console.warn(`Menghapus ${invalidList.length} resep dari Cloud karena memiliki kategori obat di luar 5 tipe standar.`);
          invalidList.forEach((inv) => {
            deleteDoc(doc(db, "prescriptions", inv.id))
              .then(() => console.log(`Berhasil membersihkan resep dengan kategori obat tidak valid: ${inv.id}`))
              .catch(err => console.error("Gagal menghapus resep tidak valid dari cloud:", err));
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, pathRef);
        setDbLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Merge helper to upload local storage data to the user's cloud account
  const handleMergeLocalToCloud = async () => {
    if (!db || !user) return;
    try {
      setDbLoading(true);
      const localData = localStorage.getItem("rekap_resep_lokal");
      if (!localData) return;

      const parsed = JSON.parse(localData) as Prescription[];
      const batchRef = writeBatch(db);

      parsed.forEach((item) => {
        // Generate a random ID for Firestore
        const newId = "prescription_" + Date.now().toString() + "_" + Math.random().toString(36).substr(2, 5);
        const docRef = doc(db, "prescriptions", newId);
        
        batchRef.set(docRef, {
          userId: user.uid,
          date: item.date,
          doctor: item.doctor || "",
          notes: item.notes || "",
          prescriptionNo: item.prescriptionNo || "",
          patientName: item.patientName || "",
          patientAddress: item.patientAddress || "",
          medicines: item.medicines,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      await batchRef.commit();

      // Clear local storage and notify success
      localStorage.removeItem("rekap_resep_lokal");
      setLocalPrescriptionsCount(0);
      setShowMergePrompt(false);
      setCustomAlert({
        type: "success",
        title: "Sinkronisasi Berhasil",
        message: `Berhasil mensinkronisasi ${parsed.length} resep lokal ke akun Cloud Anda secara otomatis!`
      });
    } catch (err) {
      console.error("Cloud merge failed:", err);
      setCustomAlert({
        type: "error",
        title: "Gagal Sinkronisasi",
        message: "Gagal mengunggah data resep. Beberapa batasan keamanan rules mungkin terjadi."
      });
    } finally {
      setDbLoading(false);
    }
  };

  const handleDeclineMerge = () => {
    // Standard decline: just clear the banner prompt but keep local data
    setShowMergePrompt(false);
  };

  // 3. CRUD actions (handles offline-first localStorage and Firestore)
  const handleSavePrescription = async (formData: Omit<Prescription, "id"> & { id?: string }) => {
    try {
      // If editing
      if (formData.id) {
        if (user && db && isFirebaseConfigured && user.uid !== "guest_user" && user.uid !== "guest_simulated") {
          // Edit Cloud
          setDbLoading(true);
          const path = `prescriptions/${formData.id}`;
          try {
            await updateDoc(doc(db, "prescriptions", formData.id), {
              date: formData.date,
              doctor: formData.doctor,
              prescriptionNo: formData.prescriptionNo,
              patientName: formData.patientName,
              patientAddress: formData.patientAddress || "",
              notes: formData.notes,
              medicines: formData.medicines,
              updatedAt: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, path);
          } finally {
            setDbLoading(false);
          }
        } else {
          // Edit Local
          const updated = prescriptions.map((p) => p.id === formData.id ? { ...p, ...formData } : p);
          setPrescriptions(updated);
          localStorage.setItem("rekap_resep_lokal", JSON.stringify(updated));
        }
      } else {
        // Create new
        const generatedId = "prescription_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
        if (user && db && isFirebaseConfigured && user.uid !== "guest_user" && user.uid !== "guest_simulated") {
          // Create Cloud
          setDbLoading(true);
          const path = `prescriptions/${generatedId}`;
          try {
            await setDoc(doc(db, "prescriptions", generatedId), {
              userId: user.uid,
              date: formData.date,
              doctor: formData.doctor,
              prescriptionNo: formData.prescriptionNo,
              patientName: formData.patientName,
              patientAddress: formData.patientAddress || "",
              notes: formData.notes,
              medicines: formData.medicines,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, path);
          } finally {
            setDbLoading(false);
          }
        } else {
          // Create Local
          const newPrescription: Prescription = {
            id: generatedId,
            date: formData.date,
            doctor: formData.doctor,
            prescriptionNo: formData.prescriptionNo,
            patientName: formData.patientName,
            patientAddress: formData.patientAddress || "",
            notes: formData.notes,
            medicines: formData.medicines
          };
          const updated = [newPrescription, ...prescriptions];
          setPrescriptions(updated);
          localStorage.setItem("rekap_resep_lokal", JSON.stringify(updated));
        }
      }

      setIsFormOpen(false);
      setEditPrescription(null);
    } catch (error: any) {
      console.error("Gagal menyimpan resep:", error);
      setCustomAlert({
        type: "error",
        title: "Gagal Menyimpan",
        message: "Gagal menyimpan resep ke Cloud: " + (error.message || error)
      });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== "string") return;
        
        let listToImport: any[] = [];
        const trimmed = result.trim();
        const isJson = trimmed.startsWith("[") || trimmed.startsWith("{");

        if (isJson) {
          const parsed = JSON.parse(trimmed);
          listToImport = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          // Parse CSV
          const lines: string[][] = [];
          let row: string[] = [];
          let inQuotes = false;
          let currentVal = "";

          for (let i = 0; i < result.length; i++) {
            const char = result[i];
            const nextChar = result[i + 1];

            if (inQuotes) {
              if (char === '"' && nextChar === '"') {
                currentVal += '"';
                i++; // skip next quote
              } else if (char === '"') {
                inQuotes = false;
              } else {
                currentVal += char;
              }
            } else {
              if (char === '"') {
                inQuotes = true;
              } else if (char === ',') {
                row.push(currentVal);
                currentVal = "";
              } else if (char === '\n' || char === '\r') {
                if (char === '\r' && nextChar === '\n') {
                  i++;
                }
                row.push(currentVal);
                lines.push(row);
                row = [];
                currentVal = "";
              } else {
                currentVal += char;
              }
            }
          }
          if (currentVal || row.length > 0) {
            row.push(currentVal);
            lines.push(row);
          }

          if (lines.length >= 2) {
            // Clean header names by removing underscores and lowercase them
            const rawHeaders = lines[0].map(h => h.trim().toLowerCase().replace(/["']/g, "").replace(/_/g, ""));
            for (let i = 1; i < lines.length; i++) {
              const currentRow = lines[i];
              if (currentRow.length === 0 || (currentRow.length === 1 && !currentRow[0])) continue;
              
              const item: Record<string, any> = {};
              for (let j = 0; j < rawHeaders.length; j++) {
                const header = rawHeaders[j];
                if (header) {
                  item[header] = (currentRow[j] || "").trim();
                }
              }
              listToImport.push(item);
            }
          }
        }
        
        if (listToImport.length === 0) {
          setCustomAlert({
            type: "error",
            title: "File Tidak Mengandung Data",
            message: "File yang diunggah tidak memiliki data atau baris resep yang valid."
          });
          return;
        }

        // Map and clean up items
        const formatted = listToImport.map((item: any) => {
          // Look up aliases
          const date = item.date || item.tanggal || item.createdat || item.created_at || new Date().toISOString().split("T")[0];
          // Truncate timestamp part if contains 'T' or space to keep YYYY-MM-DD
          const cleanDate = typeof date === "string" ? date.split(/[T\s]/)[0] : new Date().toISOString().split("T")[0];
          
          const doctor = item.doctor || item.dokter || "";
          const prescriptionNo = item.prescriptionno || item.prescription_no || item.noresep || item.no || "";
          const patientName = item.patientname || item.patient_name || item.namapasien || item.pasien || "";
          const patientAddress = item.patientaddress || item.patient_address || item.alamatpasien || item.alamat || "";
          const notes = item.notes || item.catatan || "";
          
          let medicines: any[] = [];
          const rawMedicines = item.medicines || item.obat || [];
          
          if (typeof rawMedicines === "string") {
            try {
              medicines = JSON.parse(rawMedicines);
            } catch {
              // Try replacing double quotes or single quotes in case of bad CSV format
              try {
                const sanitized = rawMedicines.replace(/""/g, '"');
                medicines = JSON.parse(sanitized);
              } catch {
                medicines = [];
              }
            }
          } else if (Array.isArray(rawMedicines)) {
            medicines = rawMedicines;
          }
          
          const formattedMedicines = (medicines || []).map((med: any) => {
            let kategori = med.kategori || med.category || "Lain-lain";
            if (!MEDICINE_CATEGORIES.includes(kategori)) {
              kategori = "Lain-lain";
            }
            return {
              nama: med.nama || med.name || "Obat Tanpa Nama",
              kategori: kategori,
              dosis: med.dosis || med.dosage || "",
              jumlah: parseFloat(med.jumlah || med.quantity || med.qty || "0") || 0
            };
          });

          return {
            date: cleanDate,
            doctor,
            prescriptionNo,
            patientName,
            patientAddress,
            notes,
            medicines: formattedMedicines
          };
        });

        // Let's import into Firestore (or LocalStorage if offline/guest)
        if (user && db && isFirebaseConfigured && user.uid !== "guest_user" && user.uid !== "guest_simulated") {
          setDbLoading(true);
          let successCount = 0;
          
          // Write documents to Firestore
          for (const item of formatted) {
            const generatedId = "prescription_import_" + Date.now().toString() + "_" + Math.random().toString(36).substr(2, 5);
            try {
              await setDoc(doc(db, "prescriptions", generatedId), {
                userId: user.uid,
                ...item,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              successCount++;
            } catch (err) {
              console.error("Failed importing item:", err);
            }
          }
          
          setDbLoading(false);
          setCustomAlert({
            type: "success",
            title: "Impor Berhasil",
            message: `Berhasil mengimpor ${successCount} dari ${formatted.length} resep obat ke database cloud Firestore secara otomatis!`
          });
        } else {
          // LocalStorage import
          const localList = [...prescriptions];
          let importedCount = 0;
          for (const item of formatted) {
            const generatedId = "prescription_import_" + Date.now().toString() + "_" + Math.random().toString(36).substr(2, 5);
            const newPrescription: Prescription = {
              id: generatedId,
              ...item
            };
            localList.unshift(newPrescription);
            importedCount++;
          }
          setPrescriptions(localList);
          localStorage.setItem("rekap_resep_lokal", JSON.stringify(localList));
          
          setCustomAlert({
            type: "success",
            title: "Impor Sukses (Lokal)",
            message: `Berhasil mengimpor ${importedCount} resep obat baru secara offline!`
          });
        }
      } catch (err: any) {
        console.error("Gagal membaca atau memproses file:", err);
        setCustomAlert({
          type: "error",
          title: "Gagal Memproses File",
          message: "Format struktur file tidak kompatibel. Detail error: " + (err.message || err)
        });
      }
    };
    reader.readAsText(file);
  };

  const handleDeletePrescription = (id: string) => {
    setPrescriptionIdToDelete(id);
  };

  const executeDeletePrescription = async (id: string) => {
    setPrescriptionIdToDelete(null);

    if (user && db && isFirebaseConfigured && user.uid !== "guest_user" && user.uid !== "guest_simulated") {
      setDbLoading(true);
      const path = `prescriptions/${id}`;
      try {
        await deleteDoc(doc(db, "prescriptions", id));
        setCustomAlert({
          type: "success",
          title: "Berhasil Dihapus",
          message: "Resep obat berhasil dihapus dari Cloud Database!"
        });
      } catch (error: any) {
        console.error("Gagal menghapus resep:", error);
        let errorMsg = error.message || String(error);
        if (errorMsg.includes("permission-denied") || errorMsg.includes("security") || errorMsg.includes("permissions")) {
          errorMsg = "Akses ditolak. Anda tidak memiliki wewenang untuk menghapus resep ini, atau resep ini dimiliki oleh sesi akun lain.";
        }
        setCustomAlert({
          type: "error",
          title: "Gagal Menghapus",
          message: errorMsg
        });
      } finally {
        setDbLoading(false);
      }
    } else {
      const updated = prescriptions.filter((p) => p.id !== id);
      setPrescriptions(updated);
      localStorage.setItem("rekap_resep_lokal", JSON.stringify(updated));
      setCustomAlert({
        type: "success",
        title: "Berhasil Dihapus",
        message: "Resep obat berhasil dihapus dari penyimpanan lokal!"
      });
    }
  };

  const handleTriggerEdit = (prescription: Prescription) => {
    setEditPrescription(prescription);
    setIsFormOpen(true);
  };

  const handleTriggerCreate = () => {
    setEditPrescription(null);
    setIsFormOpen(true);
  };

  // 4. Date Search and text filtering pipeline
  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter((p) => {
      // Date Search Filter Check
      if (searchDate && p.date !== searchDate) {
        return false;
      }

      // Date Range Filter
      if (startDate && p.date < startDate) {
        return false;
      }
      if (endDate && p.date > endDate) {
        return false;
      }

      // Query (Name of doctor / drug / category search)
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const docMatch = p.doctor?.toLowerCase().includes(queryLower);
        const notesMatch = p.notes?.toLowerCase().includes(queryLower);
        const medsMatch = p.medicines.some(
          (m) =>
            m.nama.toLowerCase().includes(queryLower) ||
            m.kategori.toLowerCase().includes(queryLower)
        );

        if (!docMatch && !medsMatch && !notesMatch) {
          return false;
        }
      }

      return true;
    });
  }, [prescriptions, searchDate, startDate, endDate, searchQuery]);

  const displayedPrescriptions = useMemo(() => {
    if (pageSize === "Semua") {
      return filteredPrescriptions;
    }
    return filteredPrescriptions.slice(0, pageSize);
  }, [filteredPrescriptions, pageSize]);

  // 5. Exporter triggers
  const handleExportPDF = () => {
    let textTitle = "Daftar Rekap Resep Obat";
    if (searchDate) textTitle += ` Tanggal ${searchDate}`;
    else if (startDate || endDate) textTitle += ` Periode ${startDate || "Awal"} s.d. ${endDate || "Akhir"}`;
    exportToPDF(filteredPrescriptions, textTitle);
  };

  const handleExportExcel = () => {
    let fileTitle = "Rekap_Resep_Obat";
    if (searchDate) fileTitle += `_${searchDate}`;
    else if (startDate || endDate) fileTitle += `_Periode_${startDate || "Awal"}_sd_${endDate || "Akhir"}`;
    exportToExcel(filteredPrescriptions, fileTitle);
  };

  const clearFilters = () => {
    setSearchDate("");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f6f9f7] flex flex-col items-center justify-center font-sans text-brand-dark">
        <div className="space-y-4 text-center">
          <div className="w-10 h-10 border-4 border-brand-medium border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-extrabold uppercase tracking-widest animate-pulse">Memuat Keamanan Sesi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginForm 
        auth={auth}
        isFirebaseReady={isFirebaseConfigured}
        onSuccess={(newUser) => {
          setUser(newUser);
        }}
        onGuestSuccess={() => {
          localStorage.setItem("rekap_guest_session", "true");
          setUser({ uid: "guest_user", email: "guest@offline.com" } as any);
        }}
      />
    );
  }

  return (
    <div id="recipe-recap-app" className="min-h-screen bg-[#f6f9f7] text-slate-800 flex flex-col font-sans selection:bg-[#bcd8c8] selection:text-[#1e3d30]">
      {/* Top Sync Banner */}
      <SyncBanner 
        user={user} 
        loading={authLoading} 
        totalPrescriptions={prescriptions.length} 
      />

      {/* Cloud merger offering invitation */}
      {showMergePrompt && localPrescriptionsCount > 0 && (
        <div id="local-merge-banner" className="bg-[#e6f4ed] border-b border-[#c2ecda] text-[#15803d] py-3 px-4 text-center text-xs font-semibold flex items-center justify-center gap-3 shadow-sm">
          <FolderSync className="w-5 h-5 animate-bounce shrink-0 text-[#3b7a6b]" />
          <span>Terdeteksi {localPrescriptionsCount} resep di browser lokal. Sinkronkan sekarang agar tersimpan aman di Cloud!</span>
          <div className="flex gap-2">
            <button
              id="btn-confirm-merge"
              onClick={handleMergeLocalToCloud}
              className="bg-[#8fc8be] hover:bg-[#7db9af] text-slate-850 rounded-lg px-3 py-1 text-[11px] font-bold border border-[#7db9af]/30 shadow-none cursor-pointer"
            >
              Sinkronkan ke Cloud
            </button>
            <button
              id="btn-ignore-merge"
              onClick={handleDeclineMerge}
              className="text-[#64748b] hover:text-slate-800 underline cursor-pointer"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      )}

      {/* Main Header / Navigation rail */}
      <header className="bg-white border-b-2 border-brand-light shrink-0 shadow-[0_4px_24px_-8px_rgba(0,59,70,0.06)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DynamicCapsuleIcon />
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-brand-dark flex items-center gap-1.5">
                <span>Apotek Rekap Resep</span>
                <span className="text-[9px] bg-brand-pink/20 border border-brand-pink/35 text-[#003b46] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">PRO</span>
              </h1>
              <p className="text-xs text-slate-500 font-semibold">Sistem Reccord Resep Medis & Monitoring Konsumsi Obat Bulanan</p>
            </div>
          </div>

          {/* Navigation Tab buttons */}
          <nav className="flex flex-wrap items-center bg-brand-light/30 p-1.5 rounded-2xl border border-brand-light">
            <button
              id="tab-history"
              onClick={() => setActiveTab("daftar")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "daftar"
                  ? "bg-brand-medium text-white shadow-md border border-brand-medium/50"
                  : "text-brand-dark hover:bg-brand-light/40 hover:text-brand-medium"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Daftar Resep & Cari
            </button>
            <button
              id="tab-analytics"
              onClick={() => setActiveTab("grafik")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "grafik"
                  ? "bg-brand-medium text-white shadow-md border border-brand-medium/50"
                  : "text-brand-dark hover:bg-brand-light/40 hover:text-brand-medium"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Grafik & Kategori
            </button>
            <button
              id="tab-monthly-report"
              onClick={() => setActiveTab("laporan")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "laporan"
                  ? "bg-brand-medium text-white shadow-md border border-brand-medium/50"
                  : "text-brand-dark hover:bg-brand-light/40 hover:text-brand-medium"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Laporan Bulanan
            </button>
            <button
              id="tab-info"
              onClick={() => setActiveTab("panduan")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "panduan"
                  ? "bg-brand-medium text-white shadow-md border border-brand-medium/50"
                  : "text-brand-dark hover:bg-brand-light/40 hover:text-brand-medium"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Panduan
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Pane */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 overflow-y-auto">
        {isFormOpen ? (
          <PrescriptionForm
            initialData={editPrescription}
            onSave={handleSavePrescription}
            onCancel={() => {
              setIsFormOpen(false);
              setEditPrescription(null);
            }}
          />
        ) : (
          <div className="space-y-6">
            
            {/* Database operation/sync loading spinner */}
            {dbLoading && (
              <div className="flex items-center justify-center gap-2 bg-white border border-[#e2eae4] py-2.5 px-4 rounded-xl text-xs text-[#3b7a6b] font-semibold animate-pulse shadow-sm">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memperbarui data Cloud...</span>
              </div>
            )}

            {/* View Switching Router */}
            {activeTab === "daftar" && (
              <div className="space-y-6">
                
                {/* Search & Filtration Widget Card */}
                <div className="bg-white border border-[#e6ece7] p-5 rounded-2xl shadow-[0_4px_24px_-4px_rgba(130,165,145,0.08)] space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#eff3ef] pb-3">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Filter className="w-4 h-4 text-[#3b7a6b]" />
                      Filter dan Cari Resep
                    </h3>
                    
                    {/* Exporters and quick create actions */}
                    <div className="flex items-center flex-wrap gap-2">
                      {/* CSV / JSON Import Button */}
                      <label
                        htmlFor="import-resep-file"
                        className="flex items-center gap-1.5 bg-white hover:bg-[#edf5f2] hover:text-[#07575b] text-slate-700 text-xs py-1.5 px-3 rounded-lg border border-[#e2eae4] hover:border-[#bfdccd] transition cursor-pointer font-bold shadow-xs"
                        title="Unggah data resep dari format CSV Supabase, JSON, atau lainnya"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                        <span>Impor Data Resep (CSV / JSON)</span>
                      </label>
                      <input
                        id="import-resep-file"
                        type="file"
                        accept=".json,.csv"
                        onChange={handleImportFile}
                        className="hidden"
                      />

                      {filteredPrescriptions.length > 0 && (
                        <>
                          <button
                            id="btn-export-excel"
                            onClick={handleExportExcel}
                            className="flex items-center gap-1 bg-white hover:bg-[#edf5f2] text-slate-700 text-xs py-1.5 px-3 rounded-lg border border-[#e2eae4] hover:border-[#bfdccd] transition cursor-pointer"
                            title="Unduh format Excel / CSV"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-[#3b7a6b]" />
                            <span>Excel</span>
                          </button>
                          <button
                            id="btn-export-pdf"
                            onClick={handleExportPDF}
                            className="flex items-center gap-1 bg-white hover:bg-[#edf5f2] text-slate-700 text-xs py-1.5 px-3 rounded-lg border border-[#e2eae4] hover:border-[#bfdccd] transition cursor-pointer"
                            title="Unduh format PDF teks"
                          >
                            <FileText className="w-3.5 h-3.5 text-rose-500" />
                            <span>PDF</span>
                          </button>
                        </>
                      )}

                      <button
                        id="btn-add-prescription"
                        onClick={handleTriggerCreate}
                        className="flex items-center gap-1.5 bg-[#8fc8be] hover:bg-[#7db9af] text-slate-850 text-xs font-bold py-1.5 px-4 rounded-lg transition border border-[#7db9af]/35 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah Resep
                      </button>
                    </div>
                  </div>

                  {/* Input parameters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                    {/* Specific Date */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                        Pencarian Tanggal Spesifik
                      </label>
                      <input
                        id="search-filter-date"
                        type="date"
                        value={searchDate}
                        onChange={(e) => {
                          setSearchDate(e.target.value);
                          // Clear range if spec is defined
                          if (e.target.value) {
                            setStartDate("");
                            setEndDate("");
                          }
                        }}
                        className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
                      />
                    </div>

                    {/* Start Date */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                        Rentang Mulai Tanggal
                      </label>
                      <input
                        id="search-filter-start"
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setSearchDate(""); // Clear spec
                        }}
                        className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
                      />
                    </div>

                    {/* End Date */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                        Rentang Sampai Tanggal
                      </label>
                      <input
                        id="search-filter-end"
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setSearchDate(""); // Clear spec
                        }}
                        className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
                      />
                    </div>

                    {/* Text keywords */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                        Cari Obat / Dokter / Catatan
                      </label>
                      <div className="relative">
                        <input
                          id="search-filter-query"
                          type="text"
                          placeholder="Ketik kata kunci..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] py-2.5 pl-8 pr-3 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                      </div>
                    </div>
                  </div>

                  {/* Clean up action is shown only if filters active */}
                  {(searchDate || startDate || endDate || searchQuery) && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 font-medium">
                        Menemukan <span className="text-[#3b7a6b] font-bold">{filteredPrescriptions.length}</span> resep cocok
                      </span>
                      <button
                        id="btn-clear-filters"
                        onClick={clearFilters}
                        className="text-[#3b7a6b] hover:text-[#2c5344] font-bold underline cursor-pointer"
                      >
                        Hapus Semua Filter
                      </button>
                    </div>
                  )}
                </div>

                {/* Grid List View of Prescriptions cards */}
                {filteredPrescriptions.length > 0 ? (
                  <div className="space-y-4">
                    {/* Page limit controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-brand-light/30 border border-brand-light/65 p-3.5 rounded-2xl text-slate-650">
                      <div className="font-bold text-[#003b46]">
                        Menampilkan <span className="text-brand-medium font-extrabold">{displayedPrescriptions.length}</span> dari total <span className="text-brand-medium font-extrabold">{filteredPrescriptions.length}</span> resep.
                      </div>
                      <div className="flex items-center gap-2 font-bold shrink-0">
                        <span className="text-slate-500">Batas Tampilan:</span>
                        <select
                          id="page-size-select"
                          value={pageSize}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPageSize(val === "Semua" ? "Semua" : Number(val));
                          }}
                          className="bg-white border-2 border-brand-light text-brand-dark px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-brand-medium text-xs font-black cursor-pointer"
                        >
                          <option value={10}>10 Resep</option>
                          <option value={20}>20 Resep</option>
                          <option value={50}>50 Resep</option>
                          <option value={100}>100 Resep</option>
                          <option value="Semua">Semua Resep</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {displayedPrescriptions.map((p) => (
                        <PrescriptionCard
                          key={p.id}
                          prescription={p}
                          onEdit={handleTriggerEdit}
                          onDelete={handleDeletePrescription}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div id="empty-state-card" className="bg-white border border-[#e6ece7] p-12 rounded-2xl text-center space-y-4 max-w-xl mx-auto shadow-sm">
                    <div className="w-16 h-16 bg-[#fafbfa] rounded-full flex items-center justify-between mx-auto border border-[#effed4]">
                      <Search className="w-7 h-7 text-slate-400 mx-auto" />
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="text-slate-800 font-bold text-lg">Tidak Ada Resep Ditemukan</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                        {prescriptions.length === 0 
                          ? "Database Anda saat ini masih kosong. Silakan tambahkan rekaman resep pertama Anda dengan menekan tombol Tambah Resep."
                          : "Tidak ada resep yang cocok dengan kriteria pencarian atau filter tanggal yang Anda tentukan."}
                      </p>
                    </div>

                    {prescriptions.length > 0 ? (
                      <button
                        id="btn-reset-empty-fiter"
                        onClick={clearFilters}
                        className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition shadow-sm"
                      >
                        Reset Pencarian Saring
                      </button>
                    ) : (
                      <button
                        id="btn-add-first-recipe"
                        onClick={handleTriggerCreate}
                        className="bg-[#8fc8be] hover:bg-[#7db9af] text-slate-855 px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm border border-[#7db9af]/35 cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4 text-slate-800" />
                        Tambah Resep Sekarang
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "grafik" && (
              <MonthlyAnalytics prescriptions={prescriptions} />
            )}

            {activeTab === "laporan" && (
              <MonthlyReport prescriptions={prescriptions} />
            )}

            {activeTab === "panduan" && (
              <div id="guidelines-card" className="bg-white border border-[#e6ece7] p-6 sm:p-8 rounded-2xl max-w-3xl mx-auto space-y-6 shadow-[0_4px_24px_-4px_rgba(130,165,145,0.08)]">
                <div className="flex items-center gap-3 border-b border-[#eff3ef] pb-4">
                  <div className="bg-[#eef5f2] p-2.5 rounded-xl text-[#3b7a6b]">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Panduan Penggunaan Rekap Resep Obat</h2>
                    <p className="text-xs text-slate-500">Cara memaksimalkan fitur pencatat resep, visualisasi grafik, dan manajemen ekspor</p>
                  </div>
                </div>

                <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
                  <div className="space-y-2">
                    <h3 className="text-slate-800 font-bold flex items-center gap-2">
                      <span className="w-5 h-5 bg-[#eef5f2] rounded-full flex items-center justify-center text-xs text-[#3b7a6b] font-extrabold border border-[#c6ecd7]">1</span>
                      Pengisian Resep dengan Banyak Obat
                    </h3>
                    <p className="pl-7 text-slate-500">
                      Anda dapat memasukkan <strong>lebih dari satu macam obat</strong> ditiap lembar resep yang disimpan. Klik tombol <strong>"Tambah Obat Baru"</strong> di form isian resep untuk menambahkan baris obat baru tanpa batas (maksimal 20 obat demi kenyamanan rendering).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-slate-800 font-bold flex items-center gap-2">
                      <span className="w-5 h-5 bg-[#eef5f2] rounded-full flex items-center justify-center text-xs text-[#3b7a6b] font-extrabold border border-[#c6ecd7]">2</span>
                      Sortir Kategori Otomatis Bulanan
                    </h3>
                    <p className="pl-7 text-slate-500">
                      Setiap tanggal resep diproses, aplikasi secara otomatis menempatkan obat Anda ke dalam kategori-kategori medis (seperti Analgesik, Antibiotik, Vitamin, dll). Di tab <strong>"Grafik & Kategori"</strong>, Anda dapat melihat total sebaran persentase tipe obat apa saja yang paling sering dikonsumsi tiap bulannya.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-slate-800 font-bold flex items-center gap-2">
                      <span className="w-5 h-5 bg-[#eef5f2] rounded-full flex items-center justify-center text-xs text-[#3b7a6b] font-extrabold border border-[#c6ecd7]">3</span>
                      Pencarian Berdasar Tanggal & Rentang
                    </h3>
                    <p className="pl-7 text-slate-500">
                      Anda dapat memfilter data obat berdasarkan satu tanggal spesifik atau rentang awal dan akhir tanggal. Sangat berguna untuk merekap konsumsi resep saat masa kontrol dokter atau check-up medis.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-slate-800 font-bold flex items-center gap-2">
                      <span className="w-5 h-5 bg-[#eef5f2] rounded-full flex items-center justify-center text-xs text-[#3b7a6b] font-extrabold border border-[#c6ecd7]">4</span>
                      Ekspor Teks PDF dan Excel
                    </h3>
                    <p className="pl-7 text-slate-500">
                      Data resep yang tampil sesuai penyaringan filter Anda dapat diekspor menjadi format file:
                    </p>
                    <ul className="list-disc pl-12 space-y-1 text-slate-500">
                      <li><strong>Excel (CSV)</strong>: Menyusun baris resep secara terstruktur/relasional sehingga siap dibuka di Microsoft Excel atau Google Sheets.</li>
                      <li><strong>PDF (Teks Murni)</strong>: Dokumen ringkasan laporan cetak beresolusi tinggi dengan baris-baris tabel yang rapi (bukan tangkapan gambar/Screenshot saja, aman disalin teksnya).</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-slate-800 font-bold flex items-center gap-2">
                      <span className="w-5 h-5 bg-[#eef5f2] rounded-full flex items-center justify-center text-xs text-[#3b7a6b] font-extrabold border border-[#c6ecd7]">5</span>
                      Aman & Sinkronisasi Cloud Otomatis
                    </h3>
                    <p className="pl-7 text-slate-500">
                      Aplikasi mendukung penyimpanan offline lokal (data disimpan di memori internal browser) dan sinkronisasi Cloud. Cukup klik tombol <strong>"Sinkron Cloud"</strong> di bagian atas dan masuk dengan Google, riwayat obat Anda otomatis tercadangkan dan terintegrasi di perangkat ponsel mau pun komputer Anda.
                    </p>
                  </div>
                </div>

                <div className="bg-[#fafbfa] p-4 rounded-xl border border-[#eef2ee] flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#3b7a6b] shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-500 leading-relaxed">
                    <strong className="text-slate-700 block mb-1">Informasi Hak Penggunaan & Privasi:</strong>
                    Tercatat secara transparan. Keamanan database didukung penuh oleh enkripsi transit SSL serta aturan Firestore Fortress Security Rules bersertifikasi enkripsi zero-breach.
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* Custom Alert/Notification Modal */}
      {customAlert && (
        <div className="fixed inset-0 bg-brand-dark/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#fdf0d5] ring-2 ring-[#dfd1af] p-6 rounded-2xl max-w-sm w-full shadow-2xl relative flex flex-col gap-4 text-[#003b46]">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-full shrink-0 border ${
                customAlert.type === "success" 
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                  : customAlert.type === "error"
                  ? "bg-rose-50 text-rose-600 border-rose-100"
                  : "bg-blue-50 text-blue-600 border-blue-100"
              }`}>
                {customAlert.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1 text-left border-none">
                <h3 className="font-extrabold text-sm text-[#003b46] tracking-tight uppercase">
                  {customAlert.title}
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                  {customAlert.message}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#dfd1af]/30">
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className="px-5 py-2.5 bg-[#07575b] text-white rounded-xl text-xs font-black transition hover:bg-[#07575b]/85 cursor-pointer shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {prescriptionIdToDelete && (
        <div className="fixed inset-0 bg-brand-dark/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#fdf0d5] ring-2 ring-[#dfd1af] p-6 rounded-2xl max-w-sm w-full shadow-2xl relative flex flex-col gap-4 text-[#003b46]">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-full shrink-0 border border-rose-100">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-left border-none">
                <h3 className="font-extrabold text-sm text-[#003b46] tracking-tight uppercase">Hapus Resep Obat</h3>
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                  Apakah Anda yakin ingin menghapus resep obat ini? Data pengeluaran obat terkait akan diperbarui. Tindakan ini tidak dapat dikembalikan.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#dfd1af]/30">
              <button
                type="button"
                onClick={() => setPrescriptionIdToDelete(null)}
                className="px-4 py-2 bg-white text-[#07575b] border border-[#dfd1af] rounded-xl text-xs font-bold transition hover:bg-neutral-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeDeletePrescription(prescriptionIdToDelete)}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition shadow-sm cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Visual Footer */}
      <footer className="bg-white border-t border-[#e2eae4] py-4 px-6 text-center text-xs text-slate-500 shrink-0">
        <p>© 2026 Resep Obat Tracker — Didesain dengan Kombinasi Warna Pastel Serene yang Nyaman</p>
      </footer>
    </div>
  );
}
