import React, { useState, useEffect, useMemo, useRef } from "react";
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
  getDocs,
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
import { Prescription, Medicine, MEDICINE_CATEGORIES, getCategoryByMedicineName } from "./types";
import { exportToPDF, exportToExcel, exportSearchResultsToPDF, exportSearchResultsToExcel } from "./utils/export";
import { SyncBanner } from "./components/SyncBanner";
import { PrescriptionForm } from "./components/PrescriptionForm";
import { PrescriptionCard } from "./components/PrescriptionCard";
import { MonthlyAnalytics } from "./components/MonthlyAnalytics";
import { MonthlyReport } from "./components/MonthlyReport";
import { LoginForm } from "./components/LoginForm";
import { DynamicCapsuleIcon } from "./components/DynamicCapsuleIcon";
import { PioKieManager } from "./components/PioKieManager";
import { DoctorMedicineOverview } from "./components/DoctorMedicineOverview";
import { motion, AnimatePresence, animate } from "motion/react";
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
  Upload,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Users
} from "lucide-react";

function fixPrescriptionCategories(prescriptionsList: Prescription[]): { updatedList: Prescription[], changedCount: number } {
  let changedCount = 0;
  const updatedList = prescriptionsList.map(p => {
    let prescriptionModified = false;
    const updatedMeds = p.medicines.map(m => {
      const correctCategory = getCategoryByMedicineName(m.nama);
      if (correctCategory && m.kategori !== correctCategory) {
        prescriptionModified = true;
        return { ...m, kategori: correctCategory };
      }
      return m;
    });
    if (prescriptionModified) {
      changedCount++;
      return { ...p, medicines: updatedMeds };
    }
    return p;
  });
  return { updatedList, changedCount };
}

function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const controls = animate(displayValue, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplayValue(Math.round(latest));
      }
    });
    return () => controls.stop();
  }, [value]);

  return <>{displayValue}</>;
}

export default function App() {
  // Dark Mode preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("rekap_resep_theme");
    if (saved) {
      return saved === "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("rekap_resep_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("rekap_resep_theme", "light");
    }
  }, [isDarkMode]);

  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Core prescription state
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [backupLoading, setBackupLoading] = useState<boolean>(false);

  // UI state managers
  const [activeTab, setActiveTab] = useState<"daftar" | "pio_kie" | "grafik" | "laporan" | "panduan" | "dokter_obat">("daftar");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editPrescription, setEditPrescription] = useState<Prescription | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl && (
          activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.hasAttribute("contenteditable")
        )
      ) {
        return;
      }

      // 'n' or 'N' for opening/closing the "tambah resep" form
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setActiveTab("daftar");
        setIsFormOpen(prev => !prev);
      }

      // 's' or 'S' for focusing search query input
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setActiveTab("daftar");
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 50);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Search & Filter state
  const [searchDate, setSearchDate] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>(""); // for searching doctor/medicine name
  const [pageSize, setPageSize] = useState<number | "Semua">(20);
  const [sortBy, setSortBy] = useState<"terbaru" | "terlama" | "nama-a-z" | "nama-z-a">("terbaru");
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    return localStorage.getItem("is_compact_prescription_mode") === "true";
  });

  useEffect(() => {
    localStorage.setItem("is_compact_prescription_mode", String(isCompact));
  }, [isCompact]);

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
        // Fix loaded local storage medicine categories to "Obat-obat Tertentu" if they match the specified drug names
        const { updatedList: fixedList, changedCount } = fixPrescriptionCategories(parsed);
        // Filter out and effectively delete any local prescription data outside of the 5 categories
        const filtered = fixedList.filter(p => p.medicines && p.medicines.every(m => m.kategori && MEDICINE_CATEGORIES.includes(m.kategori)));
        setPrescriptions(filtered);
        setLocalPrescriptionsCount(filtered.length);
        if (filtered.length !== parsed.length || changedCount > 0) {
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
            const { updatedList: fixedList, changedCount } = fixPrescriptionCategories(parsed);
            // Filter out items missing prescriptionNo or with invalid medicines
            const filtered = fixedList.filter(p => p.prescriptionNo && p.prescriptionNo.trim() !== "" && p.medicines && p.medicines.every(m => m.kategori && MEDICINE_CATEGORIES.includes(m.kategori)));
            if (filtered.length !== parsed.length || changedCount > 0) {
              localStorage.setItem("rekap_resep_lokal", JSON.stringify(filtered));
            }
            if (filtered.length > 0) {
              setLocalPrescriptionsCount(filtered.length);
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
          const { updatedList: fixedList, changedCount } = fixPrescriptionCategories(parsed);
          const filtered = fixedList.filter(p => p.prescriptionNo && p.prescriptionNo.trim() !== "" && p.medicines && p.medicines.every(m => m.kategori && MEDICINE_CATEGORIES.includes(m.kategori)));
          setPrescriptions(filtered);
          if (filtered.length !== parsed.length || changedCount > 0) {
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
        
        // Run category fixer on fetched cloud records to auto-assign "Obat-obat Tertentu" if needed
        const { updatedList: fixedList, changedCount } = fixPrescriptionCategories(fetched);

        // Filter out and clean up any prescriptions missing a prescription number or having invalid categories
        const validList = fixedList.filter(p => p.prescriptionNo && p.prescriptionNo.trim() !== "" && p.medicines && p.medicines.every(m => m.kategori && MEDICINE_CATEGORIES.includes(m.kategori)));
        const invalidList = fixedList.filter(p => !p.prescriptionNo || p.prescriptionNo.trim() === "" || !p.medicines || p.medicines.some(m => !m.kategori || !MEDICINE_CATEGORIES.includes(m.kategori)));
        
        // Sort client-side by date descending to completely bypass composite index requirements
        validList.sort((a, b) => b.date.localeCompare(a.date));
        
        setPrescriptions(validList);
        
        // Cache in localStorage too so it's fully accessible when offline
        localStorage.setItem(`rekap_resep_cloud_${user.uid}`, JSON.stringify(validList));
        setDbLoading(false);

        // If some prescriptions were updated to correct categories, push those updates back to the Cloud in the background
        if (changedCount > 0 && isFirebaseConfigured && db && user && user.uid !== "guest_user") {
          const prescriptionsToUpdate = fixedList.filter((item, index) => {
            const originalObj = fetched[index];
            return JSON.stringify(item.medicines) !== JSON.stringify(originalObj.medicines);
          });
          
          if (prescriptionsToUpdate.length > 0) {
            console.log(`Migrating ${prescriptionsToUpdate.length} cloud records to correct medicine categories...`);
            const batch = writeBatch(db);
            prescriptionsToUpdate.forEach(updatedPresc => {
              const docRef = doc(db, "prescriptions", updatedPresc.id);
              batch.update(docRef, {
                medicines: updatedPresc.medicines,
                updatedAt: serverTimestamp()
              });
            });
            batch.commit()
              .then(() => console.log("Cloud category migration completed successfully."))
              .catch(err => console.error("Cloud category migration failed:", err));
          }
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
      const { updatedList: fixedList } = fixPrescriptionCategories(parsed);
      const validToMerge = fixedList.filter(p => p.prescriptionNo && p.prescriptionNo.trim() !== "" && p.medicines && p.medicines.every(m => m.kategori && MEDICINE_CATEGORIES.includes(m.kategori)));

      if (validToMerge.length === 0) {
        localStorage.removeItem("rekap_resep_lokal");
        setLocalPrescriptionsCount(0);
        setShowMergePrompt(false);
        setCustomAlert({
          type: "success",
          title: "Selesai Bersih-bersih",
          message: "Tidak ada resep lokal valid dengan nomor resep untuk disinkronisasikan."
        });
        return;
      }

      const batchRef = writeBatch(db);

      validToMerge.forEach((item) => {
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
        message: `Berhasil mensinkronisasi ${validToMerge.length} resep lokal ke akun Cloud Anda secara otomatis!`
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
          const prescriptionNo = item.prescriptionNo || item.prescriptionno || item.prescription_no || item.noresep || item.no || "";
          const patientName = item.patientName || item.patientname || item.patient_name || item.namapasien || item.pasien || "";
          const patientAddress = item.patientAddress || item.patientaddress || item.patient_address || item.alamatpasien || item.alamat || "";
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
            const nama = med.nama || med.name || "Obat Tanpa Nama";
            const autoCategory = getCategoryByMedicineName(nama);
            
            let kategori = med.kategori || med.category || autoCategory || "Lain-lain";
            
            // If default/undefined/Lain-lain but fits our target OOT drugs
            if (autoCategory && (kategori === "Lain-lain" || !kategori)) {
              kategori = autoCategory;
            }

            if (!MEDICINE_CATEGORIES.includes(kategori)) {
              kategori = "Lain-lain";
            }
            return {
              nama: nama,
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

  const handleTogglePin = async (id: string) => {
    const item = prescriptions.find(p => p.id === id);
    if (!item) return;
    const newPinned = !item.isPinned;
    
    if (user && db && isFirebaseConfigured && user.uid !== "guest_user" && user.uid !== "guest_simulated") {
      try {
        const docRef = doc(db, "prescriptions", id);
        await updateDoc(docRef, {
          isPinned: newPinned,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Gagal update pin:", error);
      }
    } else {
      const updated = prescriptions.map((p) => p.id === id ? { ...p, isPinned: newPinned } : p);
      setPrescriptions(updated);
      localStorage.setItem("rekap_resep_lokal", JSON.stringify(updated));
    }
  };

  const handleUpdatePinNotes = async (id: string, pinNotes: string) => {
    const item = prescriptions.find(p => p.id === id);
    if (!item) return;
    
    if (user && db && isFirebaseConfigured && user.uid !== "guest_user" && user.uid !== "guest_simulated") {
      try {
        const docRef = doc(db, "prescriptions", id);
        await updateDoc(docRef, {
          pinNotes,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Gagal update pin notes:", error);
      }
    } else {
      const updated = prescriptions.map((p) => p.id === id ? { ...p, pinNotes } : p);
      setPrescriptions(updated);
      localStorage.setItem("rekap_resep_lokal", JSON.stringify(updated));
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
    const list = prescriptions.filter((p) => {
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

      // Query (Search based on patient name, prescription no, doctor, medicines, or notes)
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const docMatch = p.doctor?.toLowerCase().includes(queryLower);
        const notesMatch = p.notes?.toLowerCase().includes(queryLower);
        const patientMatch = p.patientName?.toLowerCase().includes(queryLower);
        const prescriptionNoMatch = p.prescriptionNo?.toLowerCase().includes(queryLower);
        const medsMatch = p.medicines.some(
          (m) =>
            m.nama.toLowerCase().includes(queryLower) ||
            m.kategori.toLowerCase().includes(queryLower)
        );

        if (!docMatch && !medsMatch && !notesMatch && !patientMatch && !prescriptionNoMatch) {
          return false;
        }
      }

      return true;
    });

    // Pinned prescriptions go first, then sorted within their groups based on selected sortBy choice
    return [...list].sort((a, b) => {
      const valA = a.isPinned ? 1 : 0;
      const valB = b.isPinned ? 1 : 0;
      if (valA !== valB) {
        return valB - valA;
      }
      
      if (sortBy === "terlama") {
        return (a.date || "").localeCompare(b.date || "");
      } else if (sortBy === "nama-a-z") {
        return (a.patientName || "").localeCompare(b.patientName || "");
      } else if (sortBy === "nama-z-a") {
        return (b.patientName || "").localeCompare(a.patientName || "");
      }
      // "terbaru" is the default fallback
      return (b.date || "").localeCompare(a.date || "");
    });
  }, [prescriptions, searchDate, startDate, endDate, searchQuery, sortBy]);

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
    setSortBy("terbaru");
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr || dateStr === "Tanpa Tanggal") return "Tanpa Tanggal";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return dateObj.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const filteredMedicinesStats = useMemo(() => {
    interface MedStat {
      nama: string;
      kategori: string;
      totalJumlah: number;
      doctors: { [name: string]: number };
      patients: { [name: string]: number };
    }
    const statsMap: { [medName: string]: MedStat } = {};
    
    filteredPrescriptions.forEach((p) => {
      p.medicines.forEach((m) => {
        const key = m.nama.trim().toUpperCase();
        if (!statsMap[key]) {
          statsMap[key] = {
            nama: m.nama.trim(),
            kategori: m.kategori,
            totalJumlah: 0,
            doctors: {},
            patients: {}
          };
        }
        const qty = Number(m.jumlah || 0);
        statsMap[key].totalJumlah += qty;
        
        const docName = p.doctor ? p.doctor.trim() : "Tanpa Nama Dokter";
        const patName = p.patientName ? p.patientName.trim() : "Tanpa Nama Pasien";
        
        statsMap[key].doctors[docName] = (statsMap[key].doctors[docName] || 0) + qty;
        statsMap[key].patients[patName] = (statsMap[key].patients[patName] || 0) + qty;
      });
    });
    
    return Object.values(statsMap).sort((a, b) => b.totalJumlah - a.totalJumlah);
  }, [filteredPrescriptions]);

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    let loadedPrescriptions: any[] = [];
    let loadedPioKie: any[] = [];

    const isGuest = !user || user.uid === "guest_user";

    if (isFirebaseConfigured && db && !isGuest) {
      try {
        const prescriptionsPath = "prescriptions";
        const prescriptionQuery = query(
          collection(db, prescriptionsPath),
          where("userId", "==", user.uid)
        );
        const prescriptionSnap = await getDocs(prescriptionQuery);
        prescriptionSnap.forEach((docSnap) => {
          loadedPrescriptions.push({ id: docSnap.id, ...docSnap.data() });
        });
      } catch (error) {
        setBackupLoading(false);
        setCustomAlert({
          type: "error",
          title: "Gagal Mengunduh Resep",
          message: error instanceof Error ? error.message : "Terjadi kesalahan saat mengunduh resep dari Cloud."
        });
        return;
      }

      try {
        const pioKiePath = "pio_kie";
        const pioKieQuery = query(
          collection(db, pioKiePath),
          where("userId", "==", user.uid)
        );
        const pioKieSnap = await getDocs(pioKieQuery);
        pioKieSnap.forEach((docSnap) => {
          loadedPioKie.push({ id: docSnap.id, ...docSnap.data() });
        });
      } catch (error) {
        setBackupLoading(false);
        setCustomAlert({
          type: "error",
          title: "Gagal Mengunduh Data PIO/KIE",
          message: error instanceof Error ? error.message : "Terjadi kesalahan saat mengunduh data PIO/KIE dari Cloud."
        });
        return;
      }
    } else {
      // Offline / guest mode local persistence fallback
      const cacheKey = user ? `rekap_resep_cloud_${user.uid}` : "rekap_resep_cloud_guest_user";
      const localPrescriptions = localStorage.getItem(cacheKey);
      if (localPrescriptions) {
        try {
          loadedPrescriptions = JSON.parse(localPrescriptions);
        } catch {}
      }
      const localPioKie = localStorage.getItem("rekap_pio_kie");
      if (localPioKie) {
        try {
          loadedPioKie = JSON.parse(localPioKie);
        } catch {}
      }
    }

    // Build the backup payload
    const backupData = {
      appName: "Apotek Rekap Resep",
      backupVersion: "1.0",
      timestamp: new Date().toISOString(),
      userEmail: user?.email || "guest",
      userId: user?.uid || "guest_user",
      data: {
        prescriptions: loadedPrescriptions,
        pioKieLogs: loadedPioKie
      }
    };

    try {
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      
      const formattedDate = new Date().toLocaleDateString("id-ID", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).replace(/\//g, "-");

      a.href = url;
      a.download = `backup_apotek_rekap_${formattedDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCustomAlert({
        type: "success",
        title: "Cadangan Berhasil Diunduh",
        message: `Berhasil mengekspor ${loadedPrescriptions.length} resep dan ${loadedPioKie.length} log PIO/KIE ke file JSON!`
      });
    } catch (err) {
      setCustomAlert({
        type: "error",
        title: "Gagal Membuat File",
        message: err instanceof Error ? err.message : "Kesalahan tidak dikenal saat mengekspor data."
      });
    } finally {
      setBackupLoading(false);
    }
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

          {/* Navigation Tab buttons and Theme Switcher */}
          <div className="flex items-center gap-3 flex-wrap">
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
                id="tab-pio-kie"
                onClick={() => setActiveTab("pio_kie")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "pio_kie"
                    ? "bg-brand-medium text-white shadow-md border border-brand-medium/50"
                    : "text-brand-dark hover:bg-brand-light/40 hover:text-brand-medium"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                PIO dan KIE
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
                id="tab-dokter-obat"
                onClick={() => setActiveTab("dokter_obat")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "dokter_obat"
                    ? "bg-brand-medium text-white shadow-md border border-brand-medium/50"
                    : "text-brand-dark hover:bg-brand-light/40 hover:text-brand-medium"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Ikhtisar Dokter & Obat
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

            <button
              id="theme-toggle-btn"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
              className="p-2.5 rounded-2xl bg-brand-light/35 dark:bg-brand-medium/20 text-brand-dark dark:text-brand-light hover:bg-brand-medium hover:text-white dark:hover:bg-brand-medium transition-all duration-200 cursor-pointer shadow-xs flex items-center justify-center border border-brand-light dark:border-brand-medium/30 shrink-0"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4.5 h-4.5 text-amber-500 animate-[spin_10s_linear_infinite]" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            <button
              id="btn-database-backup"
              onClick={handleDownloadBackup}
              disabled={backupLoading}
              title="Unduh Cadangan Seluruh Basis Data (JSON)"
              className="p-2.5 rounded-2xl bg-brand-light/35 dark:bg-brand-medium/20 text-brand-dark dark:text-brand-light hover:bg-brand-medium hover:text-white dark:hover:bg-brand-medium transition-all duration-200 cursor-pointer shadow-xs flex items-center justify-center border border-brand-light dark:border-brand-medium/30 shrink-0 disabled:opacity-50"
              aria-label="Download Backup"
            >
              <Download className={`w-4.5 h-4.5 ${backupLoading ? "animate-bounce" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Pane */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 overflow-y-auto">
        {isFormOpen ? (
          <PrescriptionForm
            initialData={editPrescription}
            prescriptions={prescriptions}
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
            <AnimatePresence mode="wait">
              {activeTab === "daftar" && (
                <motion.div
                  key="daftar"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="space-y-6"
                >
                  

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
                        title="Formulir Resep Baru (Shortcut: N)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Resep</span>
                        <kbd className="hidden sm:inline bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-[8px] font-mono leading-none">N</kbd>
                      </button>
                    </div>
                  </div>

                  {/* Input parameters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
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
                        max={endDate || undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStartDate(val);
                          setSearchDate(""); // Clear spec
                          if (val && endDate && val > endDate) {
                            setEndDate(val);
                          }
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
                        min={startDate || undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (startDate && val && val < startDate) {
                            setEndDate(startDate);
                          } else {
                            setEndDate(val);
                          }
                          setSearchDate(""); // Clear spec
                        }}
                        className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
                      />
                    </div>

                    {/* Sort dropdown */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5 flex items-center gap-1 justify-between">
                        <span>Urutkan Daftar</span>
                        <ArrowUpDown className="w-3 h-3 text-[#3b7a6b]" />
                      </label>
                      <select
                        id="search-filter-sort"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be] font-bold cursor-pointer transition"
                      >
                        <option value="terbaru">Terbaru (Paling Baru)</option>
                        <option value="terlama">Terlama (Paling Lama)</option>
                        <option value="nama-a-z">Nama Pasien A-Z</option>
                        <option value="nama-z-a">Nama Pasien Z-A</option>
                      </select>
                    </div>

                    {/* Text keywords */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                        <span>Cari Obat / Dokter / Pasien</span>
                        <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono font-medium lowercase text-slate-400 bg-slate-100 dark:bg-[#071c21] dark:border-[#102d33] px-1.5 py-0.5 rounded border border-slate-200">tekan <kbd className="font-extrabold uppercase bg-slate-200 dark:bg-slate-700 px-1 rounded text-[8px]">S</kbd></span>
                      </label>
                      <div className="relative">
                        <input
                          id="search-filter-query"
                          ref={searchInputRef}
                          type="text"
                          placeholder="Cari nama, dokter, obat..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-[#fbfcfa] rounded-xl border border-[#e2eae4] py-2.5 pl-8 pr-3 text-xs text-slate-800 focus:outline-none focus:border-[#8fc8be] focus:ring-1 focus:ring-[#8fc8be]"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                      </div>
                    </div>
                  </div>

                  {/* Clean up action is shown only if filters active */}
                  {(searchDate || startDate || endDate || searchQuery || sortBy !== "terbaru") && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 font-medium">
                        Menemukan <span className="text-[#3b7a6b] font-bold">{filteredPrescriptions.length}</span> resep cocok
                      </span>
                      <button
                        id="btn-clear-filters"
                        onClick={clearFilters}
                        className="text-[#3b7a6b] hover:text-[#2c5344] font-bold underline cursor-pointer hover:no-underline"
                      >
                        Hapus Semua Filter & Urutan
                      </button>
                    </div>
                  )}
                </div>

                {/* Dynamic Medicine Summary based on search / date range */}
                {filteredMedicinesStats.length > 0 && (searchQuery.trim() || searchDate || startDate || endDate) && (
                  <div className="bg-gradient-to-br from-brand-medium/5 to-brand-medium/10 border border-brand-medium/20 rounded-2xl p-5 space-y-4 dark:from-[#0d2a30]/30 dark:to-[#081d22]/30 shadow-[0_4px_24px_-4px_rgba(130,165,145,0.04)]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-brand-medium/15 pb-3 gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-[#a0eed0] uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-brand-medium" />
                          Total Akumulasi Transaksi Obat Hasil Pencarian
                        </h4>
                        <span className="text-[10px] bg-brand-medium/20 text-[#07575b] px-2.5 py-1 rounded-full font-bold uppercase dark:bg-[#10b981]/25 dark:text-[#a0eed0] border border-brand-medium/20">
                          {filteredMedicinesStats.length} Macam Obat ditemukan
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          id="btn-export-search-excel"
                          onClick={() => exportSearchResultsToExcel(filteredMedicinesStats, { query: searchQuery, date: searchDate, startDate, endDate })}
                          className="flex items-center gap-1.5 bg-white hover:bg-[#edf5f2] dark:bg-[#071c21] dark:hover:bg-[#0f3e46]/30 text-slate-700 dark:text-slate-200 text-[11px] py-1.5 px-3 rounded-lg border border-[#e2eae4] dark:border-[#102d33] hover:border-[#bfdccd] dark:hover:border-brand-medium transition cursor-pointer font-bold shadow-xs"
                          title="Unduh hasil pencarian dalam format Excel"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-[#3b7a6b] dark:text-[#34d399]" />
                          <span>Excel</span>
                        </button>
                        <button
                          id="btn-export-search-pdf"
                          onClick={() => exportSearchResultsToPDF(filteredMedicinesStats, { query: searchQuery, date: searchDate, startDate, endDate })}
                          className="flex items-center gap-1.5 bg-white hover:bg-[#edf5f2] dark:bg-[#071c21] dark:hover:bg-[#0f3e46]/30 text-slate-700 dark:text-slate-200 text-[11px] py-1.5 px-3 rounded-lg border border-[#e2eae4] dark:border-[#102d33] hover:border-[#bfdccd] dark:hover:border-brand-medium transition cursor-pointer font-bold shadow-xs"
                          title="Unduh hasil pencarian dalam format PDF"
                        >
                          <FileText className="w-3.5 h-3.5 text-rose-500" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[30rem] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredMedicinesStats.map((med, idx) => (
                        <div 
                          key={idx}
                          id={`med-search-card-${idx}`}
                          className="bg-white border border-[#e6ece7] rounded-xl p-3.5 flex flex-col justify-between hover:border-brand-medium/40 dark:hover:border-[#10b981]/50 hover:shadow-xs transition duration-200 relative dark:bg-[#071c21] dark:border-[#102d33] space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[9px] px-2 py-0.5 rounded-md font-extrabold uppercase tracking-widest block w-fit" 
                                style={{
                                  backgroundColor: med.kategori === "Narkotika" ? "rgba(239, 68, 68, 0.15)" : 
                                                   med.kategori === "Psikotropika" ? "rgba(245, 158, 11, 0.15)" :
                                                   med.kategori === "Obat-obat Tertentu" ? "rgba(59, 130, 246, 0.15)" :
                                                   med.kategori === "Prekursor" ? "rgba(16, 185, 129, 0.15)" : "rgba(107, 114, 128, 0.15)",
                                  color: med.kategori === "Narkotika" ? "#f87171" : 
                                         med.kategori === "Psikotropika" ? "#fbbf24" :
                                         med.kategori === "Obat-obat Tertentu" ? "#60a5fa" :
                                         med.kategori === "Prekursor" ? "#34d399" : "#9ca3af"
                                }}
                              >
                                {med.kategori}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">Total:</span>
                                <span className="text-xs font-black text-[#07575b] dark:text-[#a0eed0] bg-[#07575b]/10 dark:bg-[#a0eed0]/10 px-1.5 py-0.5 rounded-md">{med.totalJumlah}</span>
                              </div>
                            </div>
                            <p className="text-xs font-black text-slate-800 line-clamp-2 select-all dark:text-slate-100 uppercase" title={med.nama}>
                              {med.nama}
                            </p>
                          </div>

                          {/* Breakdown Dokter */}
                          <div className="border-t border-dashed border-slate-150 pt-2 dark:border-[#102d33] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">Detail per Dokter:</span>
                              <span className="text-[8px] text-slate-400 font-bold">{Object.keys(med.doctors).length} Dokter</span>
                            </div>
                            <div className="max-h-20 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-[10px]">
                              {Object.entries(med.doctors).map(([doc, qty]) => (
                                <div key={doc} className="flex justify-between items-center bg-slate-50 dark:bg-[#081d22]/40 px-2 py-0.5 rounded border border-slate-100 dark:border-[#0f3e46]/20">
                                  <span className="text-slate-600 dark:text-slate-300 truncate max-w-[130px] font-semibold">{doc}</span>
                                  <span className="text-brand-medium dark:text-[#a0eed0] font-bold">{qty}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Breakdown Pasien */}
                          <div className="border-t border-dashed border-slate-150 pt-2 dark:border-[#102d33] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">Detail per Pasien:</span>
                              <span className="text-[8px] text-slate-400 font-bold">{Object.keys(med.patients).length} Pasien</span>
                            </div>
                            <div className="max-h-20 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-[10px]">
                              {Object.entries(med.patients).map(([pat, qty]) => (
                                <div key={pat} className="flex justify-between items-center bg-slate-50 dark:bg-[#081d22]/40 px-2 py-0.5 rounded border border-slate-100 dark:border-[#0f3e46]/20">
                                  <span className="text-slate-600 dark:text-slate-300 truncate max-w-[130px] font-semibold">{pat}</span>
                                  <span className="text-brand-medium dark:text-[#a0eed0] font-bold">{qty}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grid List View of Prescriptions cards */}
                {filteredPrescriptions.length > 0 ? (
                  <div className="space-y-4">
                    {/* Page limit controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-brand-light/30 border border-brand-light/65 p-3.5 rounded-2xl text-slate-650">
                      <div className="font-bold text-[#003b46]">
                        Menampilkan <span className="text-brand-medium font-extrabold">{displayedPrescriptions.length}</span> dari total <span className="text-brand-medium font-extrabold">{filteredPrescriptions.length}</span> resep.
                      </div>
                      <div className="flex flex-wrap items-center gap-4 font-bold shrink-0">
                        {/* Compact mode toggle */}
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none sm:border-r border-slate-300/80 sm:pr-4">
                          <input
                            type="checkbox"
                            checked={isCompact}
                            onChange={(e) => setIsCompact(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="relative w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand-medium"></div>
                          <span className="text-[#003b46] text-xs font-extrabold uppercase tracking-wider">Mode Ringkas</span>
                        </label>

                        <div className="flex items-center gap-2">
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
                    </div>

                    <div className={`grid grid-cols-1 ${isCompact ? "md:grid-cols-2 lg:grid-cols-3 gap-4" : "md:grid-cols-2 gap-6"}`}>
                      {displayedPrescriptions.map((p) => (
                        <PrescriptionCard
                          key={p.id}
                          prescription={p}
                          onEdit={handleTriggerEdit}
                          onDelete={handleDeletePrescription}
                          onTogglePin={handleTogglePin}
                          onUpdatePinNotes={handleUpdatePinNotes}
                          isCompact={isCompact}
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
              </motion.div>
            )}

            {activeTab === "pio_kie" && (
              <motion.div
                key="pio_kie"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <PioKieManager 
                  user={user} 
                  db={db} 
                  isFirebaseReady={isFirebaseConfigured} 
                  setCustomAlert={setCustomAlert} 
                />
              </motion.div>
            )}

            {activeTab === "grafik" && (
              <motion.div
                key="grafik"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <MonthlyAnalytics prescriptions={prescriptions} />
              </motion.div>
            )}

            {activeTab === "laporan" && (
              <motion.div
                key="laporan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <MonthlyReport prescriptions={prescriptions} />
              </motion.div>
            )}

            {activeTab === "dokter_obat" && (
              <motion.div
                id="dokter-obat-overview-card"
                key="dokter_obat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <DoctorMedicineOverview prescriptions={prescriptions} />
              </motion.div>
            )}

            {activeTab === "panduan" && (
              <motion.div 
                id="guidelines-card" 
                key="panduan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="bg-white border border-[#e6ece7] p-6 sm:p-8 rounded-2xl max-w-3xl mx-auto space-y-6 shadow-[0_4px_24px_-4px_rgba(130,165,145,0.08)]"
              >
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
              </motion.div>
            )}
          </AnimatePresence>

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
