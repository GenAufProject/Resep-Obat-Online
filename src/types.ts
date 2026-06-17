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

export function getCategoryByMedicineName(nama: string): string | null {
  if (!nama) return null;
  const nameLower = nama.toLowerCase().trim();
  
  // 1. Narkotika
  const narkotikaDrugs = [
    "codein", // covers "codein 10 mg", "codein 15 mg", "codein 20 mg"
    "codikaf", // covers "codikaf 10", "codikaf 15", "codikaf 20"
    "codipront", // covers "codipront cap", "codipront cum exp cap"
    "coditam"
  ];

  const isNarkotika = narkotikaDrugs.some(narko => nameLower.includes(narko));
  if (isNarkotika) {
    return "Narkotika";
  }
  
  // 2. Psikotropika
  const psikoDrugs = [
    "alena 2",
    "alganax", // covers "alganax 0.5", "alganax 1"
    "alprazolam", // covers "alprazolam 0.5 mg", "alprazolam 1 mg"
    "analsik",
    "apisate",
    "atarax 1",
    "atarax",
    "ativan", // covers "ativan 1", "ativan 2"
    "besanmag",
    "braxidin",
    "cliad",
    "clixid",
    "clobazam",
    "clofritis",
    "clonavell odt",
    "esilgan", // covers "esilgan 1", "esilgan 2"
    "frisium",
    "frixitas", // covers "frixitas 0.5", "frixitas 1"
    "merlopam", // covers "merlopam 0.5", "merlopam 2"
    "nuzolam 1",
    "proclozam",
    "prohiper",
    "riklona",
    "stesolid rectal", // covers "stesolid rectal 5 mg", "stesolid rectal 10 mg"
    "valisanbe", // covers "valisanbe 2", "valisanbe 5"
    "xanax", // covers "xanax 0.5", "xanax 1"
    "zolmia",
    "zolta",
    "zypras" // covers "zypras 0.5", "zypras 1"
  ];

  const isPsiko = psikoDrugs.some(psiko => nameLower.includes(psiko));
  if (isPsiko) {
    return "Psikotropika";
  }

  // 2. Obat-obat Tertentu
  const ootDrugs = [
    "hexymer",
    "tramadol",
    "tradosik",
    "pyrexin extra",
    "analtram",
    "lodomer 2",
    "lodomer 5",
    "arkine",
    "amitriptyline",
    "dores 5"
  ];
  
  const isOot = ootDrugs.some(oot => nameLower.includes(oot));
  if (isOot) {
    return "Obat-obat Tertentu";
  }

  return null;
}
