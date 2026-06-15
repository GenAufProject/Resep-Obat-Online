export interface Medicine {
  nama: string;
  kategori: string;
  dosis?: string;
  jumlah: number;
}

export interface Prescription {
  id: string;
  userId?: string;
  date: string; // Format: YYYY-MM-DD
  doctor: string;
  notes: string;
  prescriptionNo: string; // Nomor Resep
  patientName: string; // Nama Pasien
  patientAddress?: string; // Alamat Pasien (opsional)
  medicines: Medicine[];
  createdAt?: string | Date | any;
  updatedAt?: string | Date | any;
}

export interface CategorySummary {
  kategori: string;
  count: number; // Number of unique items under this category
  totalJumlah: number; // Sum of quantities of medicines
  percentage: number;
}

export interface MonthlyStats {
  monthKey: string; // Format: YYYY-MM
  monthName: string; // Format: Juni 2026
  prescriptionCount: number;
  totalQuantity: number;
  categories: CategorySummary[];
}

export const MEDICINE_CATEGORIES = [
  "Narkotika",
  "Psikotropika",
  "Obat-obat Tertentu",
  "Prekursor",
  "Lain-lain"
];
