import { jsPDF } from "jspdf";
import { Prescription } from "@/src/types";

/**
 * Exports prescription data to a clean, text-based A4 PDF document (not an image).
 */
export function exportToPDF(prescriptions: Prescription[], titleStr: string = "Daftar Rekap Resep Obat") {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  let y = 20;

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text(titleStr, 14, y);
  y += 8;

  // Subtitle / Date Generated
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate-500
  const currentDateStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  doc.text(`Laporan dibuat pada: ${currentDateStr}`, 14, y);
  y += 12;

  // Add a simple summary of totals
  const totalItems = prescriptions.reduce((sum, p) => sum + p.medicines.reduce((s, m) => s + m.jumlah, 0), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(`Ringkasan: ${prescriptions.length} Resep, Total ${totalItems} Obat Terkonsumsi`, 14, y);
  y += 8;

  // Draw Header Column of our Table
  const drawTableHeader = (currentY: number) => {
    doc.setFillColor(15, 23, 42); // Very clean rich slate/black background
    doc.rect(14, currentY, 182, 8, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    
    doc.text("RESEP/PASIEN/DR", 16, currentY + 5.5);
    doc.text("INFORMASI OBAT & KATEGORI", 70, currentY + 5.5);
    doc.text("DOSIS & JML", 140, currentY + 5.5);
    doc.text("CATATAN", 165, currentY + 5.5);
  };

  drawTableHeader(y);
  y += 8;

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  prescriptions.forEach((item) => {
    // Check page overflow
    if (y > 255) {
      doc.addPage();
      y = 20;
      drawTableHeader(y);
      y += 8;
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }

    // Row starting position
    const rowStart = y;

    // Date, Prescription No, Patient, and Doctor combined text
    const dateStr = item.date;
    const recipeNo = item.prescriptionNo ? `#${item.prescriptionNo}` : "-";
    const patientStr = item.patientName || "-";
    const docStr = item.doctor ? `Dr. ${item.doctor}` : "-";
    const leftText = `${dateStr}\nNo: ${recipeNo}\nPasien: ${patientStr}\nDr: ${docStr}`;

    // Medicines listed
    let medY = y + 4.5;
    let maxMedWidth = 68;
    item.medicines.forEach((med, mIdx) => {
      const medNameCategory = `${mIdx + 1}. ${med.nama}\n    [${med.kategori}]`;
      const medNameWrapped = doc.splitTextToSize(medNameCategory, maxMedWidth);
      
      const doseQty = `${med.dosis || "t.p.d"}\n(${med.jumlah} pcs)`;
      const doseQtyWrapped = doc.splitTextToSize(doseQty, 22);

      // Check overflow for sub-elements and render
      const linesCount = Math.max(medNameWrapped.length, doseQtyWrapped.length);
      
      doc.setFont("helvetica", "bold");
      doc.text(medNameWrapped, 70, medY);
      doc.setFont("helvetica", "normal");
      doc.text(doseQtyWrapped, 140, medY);
      
      medY += (linesCount * 4) + 2;
    });

    // Write left side info
    doc.setFont("helvetica", "bold");
    const leftWrapped = doc.splitTextToSize(leftText, 52);
    doc.text(leftWrapped, 16, y + 4.5);
    doc.setFont("helvetica", "normal");

    // Write notes
    const notesStr = `${item.notes || "-"}${item.patientAddress ? `\nAlamat: ${item.patientAddress}` : ""}`;
    const notesWrapped = doc.splitTextToSize(notesStr, 28);
    doc.text(notesWrapped, 165, y + 4.5);

    // Dynamic row calculation
    const medicinesEndHeight = medY - y;
    const textColumnsEndHeight = Math.max(leftWrapped.length * 4.5, notesWrapped.length * 4.5);
    const rowHeight = Math.max(15, medicinesEndHeight, textColumnsEndHeight) + 3;

    // Draw row separator line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.line(14, rowStart + rowHeight, 196, rowStart + rowHeight);

    y += rowHeight;
  });

  doc.save(`${titleStr.replace(/\s+/g, "_")}.pdf`);
}

/**
 * Exports data to Excel-compatible UTF-8 BOM CSV format.
 */
export function exportToExcel(prescriptions: Prescription[], titleStr: string = "Rekap_Resep_Obat") {
  const headers = ["No", "Tanggal", "No Resep", "Pasien", "Alamat Pasien", "Dokter", "Catatan", "Nama Obat", "Kategori", "Dosis", "Jumlah"];
  const rows: string[][] = [];
  let index = 1;

  prescriptions.forEach((p) => {
    p.medicines.forEach((m) => {
      rows.push([
        String(index++),
        p.date,
        p.prescriptionNo || "",
        p.patientName || "",
        p.patientAddress || "",
        p.doctor || "",
        p.notes || "",
        m.nama,
        m.kategori,
        m.dosis || "",
        String(m.jumlah)
      ]);
    });
  });

  const escapeCSV = (str: string) => {
    let escaped = str.replace(/"/g, '""');
    if (escaped.includes(",") || escaped.includes("\n") || escaped.includes("\r") || escaped.includes('"')) {
      escaped = `"${escaped}"`;
    }
    return escaped;
  };

  // Add the \uFEFF BOM character to preserve UTF-8 compatibility inside Excel
  const csvContent = "\uFEFF" + [
    headers.map(escapeCSV).join(","),
    ...rows.map(r => r.map(escapeCSV).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${titleStr.replace(/\s+/g, "_")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports monthly stock of a single specific category to a clean PDF report.
 */
export function exportCategoryStockToPDF(
  category: string,
  monthName: string,
  drugs: Array<{ nama: string; stokAwal: number; pemasukan: number; pengeluaran: number; stokAkhir: number }>
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  let y = 20;

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(7, 87, 91); // Brand Active Teal
  doc.text("Laporan Bulanan Stok Sediaan Obat", 14, y);
  y += 8;

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(`Kategori: ${category}  |  Periode Bulan: ${monthName}`, 14, y);
  y += 6;
  
  const currentDateStr = new Date().toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  doc.text(`Dicetak pada: ${currentDateStr}`, 14, y);
  y += 10;

  // Draw Header Column of our Table
  const drawTableHeader = (currentY: number) => {
    doc.setFillColor(0, 59, 70); // Brand Dark Navy Teal
    doc.rect(14, currentY, 182, 8, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    
    doc.text("NO", 16, currentY + 5.5);
    doc.text("NAMA OBAT", 26, currentY + 5.5);
    doc.text("STOK AWAL", 90, currentY + 5.5);
    doc.text("PEMASUKAN", 115, currentY + 5.5);
    doc.text("PENGELUARAN", 140, currentY + 5.5);
    doc.text("STOK AKHIR", 168, currentY + 5.5);
  };

  drawTableHeader(y);
  y += 8;

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  drugs.forEach((drug, index) => {
    // Check page overflow
    if (y > 270) {
      doc.addPage();
      y = 20;
      drawTableHeader(y);
      y += 8;
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
    }

    const rowStart = y;
    
    // Draw columns
    doc.text(String(index + 1), 16, y + 4.5);
    
    // Wrap drug name if it is long
    const nameWrapped = doc.splitTextToSize(drug.nama, 60);
    doc.setFont("helvetica", "bold");
    doc.text(nameWrapped, 26, y + 4.5);
    doc.setFont("helvetica", "normal");
    
    doc.text(`${drug.stokAwal} pcs`, 90, y + 4.5);
    doc.text(`${drug.pemasukan} pcs`, 115, y + 4.5);
    doc.text(`${drug.pengeluaran} pcs`, 140, y + 4.5);
    
    if (drug.stokAkhir < 0) {
      doc.setTextColor(220, 38, 38); // Rose-600 for negative final stock
      doc.setFont("helvetica", "bold");
    }
    doc.text(`${drug.stokAkhir} pcs`, 168, y + 4.5);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");

    const rowHeight = Math.max(10, nameWrapped.length * 4.5 + 2);
    
    // Draw row separator line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.25);
    doc.line(14, rowStart + rowHeight, 196, rowStart + rowHeight);

    y += rowHeight;
  });

  doc.save(`Laporan_Stok_${category.replace(/\s+/g, "_")}_${monthName.replace(/\s+/g, "_")}.pdf`);
}

/**
 * Exports monthly stock of a single specific category to an Excel-compatible CSV.
 */
export function exportCategoryStockToExcel(
  category: string,
  monthName: string,
  drugs: Array<{ nama: string; stokAwal: number; pemasukan: number; pengeluaran: number; stokAkhir: number }>
) {
  const headers = ["No", "Nama Obat", "Kategori", "Bulan", "Stok Awal", "Jumlah Pemasukan", "Jumlah Pengeluaran", "Stok Akhir"];
  const rows: string[][] = [];

  drugs.forEach((d, index) => {
    rows.push([
      String(index + 1),
      d.nama,
      category,
      monthName,
      String(d.stokAwal),
      String(d.pemasukan),
      String(d.pengeluaran),
      String(d.stokAkhir)
    ]);
  });

  const escapeCSV = (str: string) => {
    let escaped = str.replace(/"/g, '""');
    if (escaped.includes(",") || escaped.includes("\n") || escaped.includes("\r") || escaped.includes('"')) {
      escaped = `"${escaped}"`;
    }
    return escaped;
  };

  // Add the \uFEFF BOM character to preserve UTF-8 compatibility inside Excel
  const csvContent = "\uFEFF" + [
    headers.map(escapeCSV).join(","),
    ...rows.map(r => r.map(escapeCSV).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Laporan_Stok_${category.replace(/\s+/g, "_")}_${monthName.replace(/\s+/g, "_")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface SearchResultMedicineStat {
  nama: string;
  kategori: string;
  totalJumlah: number;
  doctors: { [name: string]: number };
  patients: { [name: string]: number };
}

export function exportSearchResultsToPDF(
  stats: SearchResultMedicineStat[],
  filtersInfo: { query: string; date: string; startDate: string; endDate: string }
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const truncateString = (str: string, maxLength: number) => {
    if (str.length > maxLength) {
      return str.substring(0, maxLength - 3) + "...";
    }
    return str;
  };

  let y = 20;

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(7, 87, 91); // Brand Active Teal
  doc.text("Laporan Akumulasi Transaksi Obat (Hasil Pencarian)", 14, y);
  y += 8;

  // Subtitle (Filters info)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate-500

  const filterParts = [];
  if (filtersInfo.query) filterParts.push(`Kata Kunci: "${filtersInfo.query}"`);
  if (filtersInfo.date) filterParts.push(`Tanggal: ${filtersInfo.date}`);
  if (filtersInfo.startDate && filtersInfo.endDate) filterParts.push(`Periode: ${filtersInfo.startDate} s/d ${filtersInfo.endDate}`);
  else if (filtersInfo.startDate) filterParts.push(`Mulai: ${filtersInfo.startDate}`);
  else if (filtersInfo.endDate) filterParts.push(`Sampai: ${filtersInfo.endDate}`);

  const subtitleStr = filterParts.length > 0 ? filterParts.join(" | ") : "Semua Transaksi";
  doc.text(subtitleStr, 14, y);
  y += 5;

  const currentDateStr = new Date().toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  doc.text(`Dicetak pada: ${currentDateStr} | Total: ${stats.length} Macam Obat`, 14, y);
  y += 10;

  stats.forEach((med, index) => {
    const docEntries = Object.entries(med.doctors).sort((a, b) => b[1] - a[1]);
    const patEntries = Object.entries(med.patients).sort((a, b) => b[1] - a[1]);
    const maxRows = Math.max(docEntries.length, patEntries.length);

    // Calculate height needed for this entire block
    const headerHeight = 7;
    const subheaderHeight = 5;
    const rowHeight = 4.5;
    const spacingAfterBlock = 6;
    const blockHeight = headerHeight + 1.5 + subheaderHeight + 1 + (maxRows * rowHeight) + spacingAfterBlock;

    // Page-break if we overflow 275mm height on A4
    if (y + blockHeight > 275) {
      doc.addPage();
      y = 20;
    }

    // 1. Medicine Header Section (Solid background block)
    doc.setFillColor(7, 87, 91); // Brand active teal
    doc.rect(14, y, 182, headerHeight, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    
    // Left-aligned name
    const titleText = `${index + 1}. ${med.nama.toUpperCase()}   [ ${med.kategori || "Lain-lain"} ]`;
    doc.text(titleText, 17, y + 4.8);

    // Right-aligned total quantity
    doc.text(`TOTAL: ${med.totalJumlah} pcs`, 193, y + 4.8, { align: "right" });

    y += headerHeight + 1.5;

    // 2. Side-by-side Table Columns Sub-Headers
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 59, 70); // Dark teal

    // Left Column Header: Dokter
    doc.text("NAMA DOKTER", 17, y + 3.5);
    doc.text("QTY", 92, y + 3.5, { align: "right" });
    doc.setDrawColor(7, 87, 91);
    doc.setLineWidth(0.25);
    doc.line(14, y + 4.5, 96, y + 4.5);

    // Right Column Header: Pasien
    doc.text("NAMA PASIEN", 109, y + 3.5);
    doc.text("QTY", 193, y + 3.5, { align: "right" });
    doc.line(106, y + 4.5, 196, y + 4.5);

    y += subheaderHeight + 1;

    // 3. Render side-by-side rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85); // Slate-700

    for (let i = 0; i < maxRows; i++) {
      const docItem = docEntries[i];
      const patItem = patEntries[i];

      // Draw Doctor entry
      if (docItem) {
        const docName = docItem[0];
        const docQty = docItem[1];
        doc.text(truncateString(docName, 42), 17, y + 3.2);
        doc.setFont("helvetica", "bold");
        doc.text(`${docQty} pcs`, 92, y + 3.2, { align: "right" });
        doc.setFont("helvetica", "normal");
      } else {
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text("-", 17, y + 3.2);
        doc.setTextColor(51, 65, 85);
      }

      // Draw Patient entry
      if (patItem) {
        const patName = patItem[0];
        const patQty = patItem[1];
        doc.text(truncateString(patName, 42), 109, y + 3.2);
        doc.setFont("helvetica", "bold");
        doc.text(`${patQty} pcs`, 193, y + 3.2, { align: "right" });
        doc.setFont("helvetica", "normal");
      } else {
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text("-", 109, y + 3.2);
        doc.setTextColor(51, 65, 85);
      }

      // Draw subtle divider line between rows
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.15);
      doc.line(14, y + 4.2, 196, y + 4.2);

      y += rowHeight;
    }

    // Add extra vertical padding after each medicine block
    y += spacingAfterBlock - 2;
  });

  const stamp = new Date().toISOString().substring(0, 10);
  doc.save(`Hasil_Pencarian_Obat_${stamp}.pdf`);
}

export function exportSearchResultsToExcel(
  stats: SearchResultMedicineStat[],
  filtersInfo: { query: string; date: string; startDate: string; endDate: string }
) {
  const headers = [
    "No", 
    "Nama Obat", 
    "Kategori", 
    "Total Jumlah (pcs)", 
    "Nama Dokter", 
    "Jumlah (Dokter)", 
    "Nama Pasien", 
    "Jumlah (Pasien)"
  ];
  
  const rows: string[][] = [];

  stats.forEach((med, index) => {
    const docEntries = Object.entries(med.doctors).sort((a, b) => b[1] - a[1]);
    const patEntries = Object.entries(med.patients).sort((a, b) => b[1] - a[1]);
    const maxRows = Math.max(docEntries.length, patEntries.length);

    for (let i = 0; i < maxRows; i++) {
      const docItem = docEntries[i];
      const patItem = patEntries[i];

      rows.push([
        // Only write core metadata on the first row of each medicine block
        i === 0 ? String(index + 1) : "",
        i === 0 ? med.nama : "",
        i === 0 ? med.kategori : "",
        i === 0 ? String(med.totalJumlah) : "",
        
        // Doctor details for this row
        docItem ? docItem[0] : "",
        docItem ? String(docItem[1]) : "",
        
        // Patient details for this row
        patItem ? patItem[0] : "",
        patItem ? String(patItem[1]) : ""
      ]);
    }
    
    // Add a blank separator row to neatly delimit different medicines
    rows.push(["", "", "", "", "", "", "", ""]);
  });

  const escapeCSV = (str: string) => {
    let escaped = str.replace(/"/g, '""');
    if (escaped.includes(",") || escaped.includes("\n") || escaped.includes("\r") || escaped.includes('"')) {
      escaped = `"${escaped}"`;
    }
    return escaped;
  };

  // Add the \uFEFF BOM character to preserve UTF-8 compatibility inside Excel
  const csvContent = "\uFEFF" + [
    headers.map(escapeCSV).join(","),
    ...rows.map(r => r.map(escapeCSV).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().substring(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `Hasil_Pencarian_Obat_${stamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

