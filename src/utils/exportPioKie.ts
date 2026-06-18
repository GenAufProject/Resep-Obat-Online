import { jsPDF } from "jspdf";
import { PioKieRecord } from "../types";

/**
 * Exports a single PIO/KIE record to a beautifully styled, professional, 1-page A4 PDF document.
 */
export function exportPioKieRecordToPDF(record: PioKieRecord) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const titleType = record.jenisDokumentasi === "PIO" ? "PELAYANAN INFORMASI OBAT (PIO)" : "KONSELING & KIE";
  
  // 1. Decorative Header Banner
  doc.setFillColor(7, 87, 91); // #07575b - Beautiful rich teal
  doc.rect(14, 15, 182, 24, "F");

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("DOKUMENTASI PELAYANAN KEFARMASIAN", 20, 23);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(173, 226, 212); // Minty pastel light
  doc.text(titleType, 20, 31);

  // Logo / Decorative stamp on top right
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.rect(165, 19, 23, 16, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("APOTEK", 172, 25);
  doc.text("REKAP", 173, 29);
  doc.setFont("helvetica", "bold");
  doc.text("PRO", 175, 33);

  let y = 48;

  // 2. Document Identity
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(`No. Dokumentasi :  ${record.nomorDokumentasi}`, 14, y);

  const formattedDate = new Date(record.date).toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  doc.setFont("helvetica", "normal");
  doc.text(`Tanggal: ${formattedDate}`, 120, y);

  y += 6;
  doc.line(14, y, 196, y);
  
  // 3. Main Split Section: Patient Data & Consultation Data
  y += 10;
  const col1X = 14;
  const col2X = 105;

  // Left Section Header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(col1X, y, 85, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(7, 87, 91);
  doc.text("DATA PASIEN", col1X + 4, y + 5.5);

  // Right Section Header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(col2X, y, 91, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(7, 87, 91);
  doc.text("LAYANAN KONSULTASI", col2X + 4, y + 5.5);

  const metaStartY = y + 8;
  let leftY = metaStartY + 6;
  let rightY = metaStartY + 6;

  // Render Patient Metadata Left side
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  // Patient Name
  doc.setFont("helvetica", "bold");
  doc.text("Nama Pasien:", col1X + 2, leftY);
  leftY += 4.5;
  doc.setFont("helvetica", "normal");
  const nameWrapped = doc.splitTextToSize(record.namaPasien, 78);
  doc.text(nameWrapped, col1X + 4, leftY);
  leftY += (nameWrapped.length * 4.5) + 2;

  // Gender
  doc.setFont("helvetica", "bold");
  doc.text("Jenis Kelamin:", col1X + 2, leftY);
  leftY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.text(record.jenisKelamin, col1X + 4, leftY);
  leftY += 6;

  // Age & Weight
  doc.setFont("helvetica", "bold");
  doc.text("Umur & Berat Badan:", col1X + 2, leftY);
  leftY += 4.5;
  doc.setFont("helvetica", "normal");
  const ageStr = record.umur ? `${record.umur} Tahun` : "-";
  const weightStr = record.beratBadan ? `${record.beratBadan} kg` : "-";
  doc.text(`${ageStr}  /  ${weightStr}`, col1X + 4, leftY);
  leftY += 6;

  // Pregnancy / Lactation status
  doc.setFont("helvetica", "bold");
  doc.text("Hamil / Menyusui:", col1X + 2, leftY);
  leftY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.text(record.hamilMenyusui || "Tidak / Tidak Ada Data", col1X + 4, leftY);
  leftY += 6;

  // Allergy history
  doc.setFont("helvetica", "bold");
  doc.text("Riwayat Alergi:", col1X + 2, leftY);
  leftY += 4.5;
  doc.setFont("helvetica", "normal");
  const allergyWrapped = doc.splitTextToSize(record.riwayatAlergi || "Tidak Ada Riwayat Alergi", 78);
  doc.text(allergyWrapped, col1X + 4, leftY);
  leftY += (allergyWrapped.length * 4.5) + 4;


  // Render Consultation Details Right side
  doc.setFontSize(9);
  
  // Method
  doc.setFont("helvetica", "bold");
  doc.text("Metode Pelayanan:", col2X + 2, rightY);
  rightY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.text(record.metode, col2X + 4, rightY);
  rightY += 6;

  // Reference if available
  doc.setFont("helvetica", "bold");
  doc.text("Referensi Literature / Pedoman:", col2X + 2, rightY);
  rightY += 4.5;
  doc.setFont("helvetica", "normal");
  const refWrapped = doc.splitTextToSize(record.referensi || "Instruksi Komparasi Formularium / Brosur Resmi", 84);
  doc.text(refWrapped, col2X + 4, rightY);
  rightY += (refWrapped.length * 4.5) + 6;

  // Apoteker Berwenang
  doc.setFont("helvetica", "bold");
  doc.text("Apoteker Pengonseling:", col2X + 2, rightY);
  rightY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.text(record.namaApoteker, col2X + 4, rightY);
  rightY += 6;

  // Align sections and outline boxes
  const maxHeight = Math.max(leftY, rightY) - metaStartY;
  
  // Draw nice borderline dividers
  doc.setDrawColor(226, 232, 240);
  doc.line(col2X - 2, metaStartY, col2X - 2, metaStartY + maxHeight);

  y = metaStartY + maxHeight + 10;

  // Draw a clean divider
  doc.setDrawColor(200, 215, 210);
  doc.setLineWidth(0.4);
  doc.line(14, y, 196, y);
  
  y += 8;

  // 4. Keluhan / Pertanyaan (Textarea layout)
  doc.setFillColor(248, 250, 252); // soft slate
  doc.rect(14, y, 182, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(7, 87, 91);
  doc.text("PERTANYAAN / KELUHAN (PASIEN)", 18, y + 3.5);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const complaintWrapped = doc.splitTextToSize(record.keluhanPertanyaan, 174);
  doc.text(complaintWrapped, 18, y);
  
  y += (complaintWrapped.length * 5) + 8;

  // 5. Jawaban / Tindak Lanjut
  doc.setFillColor(248, 250, 252); // soft slate
  doc.rect(14, y, 182, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(7, 87, 91);
  doc.text("JAWABAN / TINDAK LANJUT APOTEKER (KOMUNIKASI INFORMASI EDUKASI)", 18, y + 3.5);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const answerWrapped = doc.splitTextToSize(record.jawabanTindakLanjut, 174);
  doc.text(answerWrapped, 18, y);
  
  y += (answerWrapped.length * 5) + 12;

  // 6. Signature Area / Stamp
  const sigY = 225; // Locked at some nice height near bottom-right to fit exact 1 A4 page beautifully
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Penerima Informasi / Pasien,", 24, sigY);
  doc.text("Apoteker Pelaksana,", 130, sigY);

  // Drawn stamp decoration box on the right
  doc.setDrawColor(7, 87, 91, 0.4); // soft green border for stamp
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(125, sigY + 6, 52, 21, "S");
  doc.setLineDashPattern([], 0); // Reset dash

  // Inside Stamp Texts
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(7, 87, 91);
  doc.text("PRO-STATUS VERIFIED", 132, sigY + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Apotek Rekap Resep PRO", 132, sigY + 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(record.namaApoteker, 132, sigY + 21);

  // Left signature line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(24, sigY + 23, 62, sigY + 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(record.namaPasien, 24, sigY + 27);

  // Footer note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Dokumen ini sah dikeluarkan dan terverifikasi secara digital melalui Konseling Farmasi AI-Apotek PRO.", 14, 280);

  // Save the PDF locally
  doc.save(`${record.nomorDokumentasi}.pdf`);
}
