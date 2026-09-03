// Pembuat file ekspor (Excel / CSV / PDF) yang berjalan 100% di browser (offline).
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { rupiah } from "./format";

const RUPIAH_FMT = '"Rp"#,##0';
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveCsv(text, filename) {
  saveBlob(new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" }), filename);
}

function stamp() {
  return new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ---------------- Excel (exceljs) ----------------
export async function exportBusinessExcel(business, report, monthly, transactions, periodLabel, filename) {
  const thin = { style: "thin", color: { argb: "FFE2E8F0" } };
  const BORDER = { top: thin, left: thin, right: thin, bottom: thin };
  const headerCell = (cell, text) => {
    cell.value = text;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER;
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "KasUMKM";

  const ws = wb.addWorksheet("Ringkasan", { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 2;
  ["B", "C", "D", "E"].forEach((c) => (ws.getColumn(c).width = 20));

  ws.getCell("B2").value = "KasUMKM";
  ws.getCell("B2").font = { bold: true, size: 10, color: { argb: "FF059669" } };
  ws.getCell("B3").value = business.name;
  ws.getCell("B3").font = { bold: true, size: 18, color: { argb: "FF0F172A" } };
  ws.getCell("B4").value = `Laporan periode ${periodLabel}`;
  ws.getCell("B4").font = { size: 10, color: { argb: "FF475569" } };

  const kpis = [
    ["Saldo Awal", report.opening_balance, "FF475569"],
    ["Uang Masuk", report.total_income, "FF059669"],
    ["Uang Keluar", report.total_expense, "FFDC2626"],
    ["Laba Bersih", report.net_profit, report.net_profit >= 0 ? "FF059669" : "FFDC2626"],
    ["Saldo Akhir", report.closing_balance, "FF0F172A"],
  ];
  ws.getCell("B6").value = "RINGKASAN KEUANGAN";
  ws.getCell("B6").font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
  let r = 7;
  kpis.forEach(([label, val, color]) => {
    ws.getCell(`B${r}`).value = label;
    ws.getCell(`B${r}`).font = { size: 10, color: { argb: "FF475569" } };
    const c = ws.getCell(`C${r}`);
    c.value = val;
    c.numFmt = RUPIAH_FMT;
    c.font = { bold: true, size: 12, color: { argb: color } };
    r += 1;
  });

  const mstart = r + 1;
  ws.getCell(`B${mstart}`).value = "6 BULAN TERAKHIR";
  ws.getCell(`B${mstart}`).font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
  const hdr = mstart + 1;
  ["Bulan", "Uang Masuk", "Uang Keluar", "Laba"].forEach((h, i) => headerCell(ws.getRow(hdr).getCell(2 + i), h));
  monthly.forEach((m, j) => {
    const row = ws.getRow(hdr + 1 + j);
    const bcell = row.getCell(2);
    bcell.value = m.month;
    bcell.border = BORDER;
    ["income", "expense", "profit"].forEach((key, k) => {
      const c = row.getCell(3 + k);
      c.value = m[key];
      c.numFmt = RUPIAH_FMT;
      c.border = BORDER;
    });
  });

  const ts = wb.addWorksheet("Transaksi", { views: [{ showGridLines: false }] });
  ts.getColumn(1).width = 2;
  const tcols = [["Tanggal", 14], ["Jenis", 12], ["Kategori", 20], ["Deskripsi", 36], ["Metode", 16], ["Nominal", 16]];
  tcols.forEach(([, w], i) => (ts.getColumn(2 + i).width = w));
  ts.getCell("B2").value = `${business.name} \u2014 Daftar Transaksi (${periodLabel})`;
  ts.getCell("B2").font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
  tcols.forEach(([h], i) => headerCell(ts.getRow(4).getCell(2 + i), h));
  transactions.forEach((t, j) => {
    const row = ts.getRow(5 + j);
    const isIncome = t.type === "income";
    const vals = [
      t.date || "",
      isIncome ? "Uang Masuk" : "Uang Keluar",
      t.category || "",
      t.description || "",
      t.payment_method || "",
      t.amount || 0,
    ];
    vals.forEach((v, k) => {
      const c = row.getCell(2 + k);
      c.value = v;
      c.border = BORDER;
      if (k === 5) {
        c.numFmt = RUPIAH_FMT;
        c.font = { size: 10, bold: true, color: { argb: isIncome ? "FF059669" : "FFDC2626" } };
      } else {
        c.font = { size: 10, color: { argb: "FF0F172A" } };
      }
      if (j % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: XLSX_MIME }), filename);
}

// ---------------- CSV ----------------
function csvRow(arr) {
  return arr
    .map((v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

export function transactionsCsv(rows) {
  const lines = [csvRow(["Tanggal", "Deskripsi", "Kategori", "Jenis", "Nominal", "Metode Pembayaran", "Status"])];
  rows.forEach((t) =>
    lines.push(
      csvRow([
        t.date || "",
        t.description || "",
        t.category || "",
        t.type === "income" ? "Uang Masuk" : "Uang Keluar",
        Math.round(t.amount || 0),
        t.payment_method || "",
        t.status || "",
      ])
    )
  );
  return lines.join("\r\n");
}

export function reportCsv(name, period, report, kind) {
  const lines = [csvRow([name]), csvRow([`Periode: ${period}`]), csvRow([`Dibuat: ${stamp()}`]), ""];
  if (kind === "pnl") {
    lines.push(csvRow(["Laba / Rugi"]));
    lines.push(csvRow(["Uang Masuk", Math.round(report.total_income)]));
    lines.push(csvRow(["Uang Keluar", Math.round(report.total_expense)]));
    lines.push(csvRow(["Laba Bersih", Math.round(report.net_profit)]));
  } else if (kind === "cashflow") {
    lines.push(csvRow(["Arus Kas"]));
    lines.push(csvRow(["Saldo Awal", Math.round(report.opening_balance)]));
    lines.push(csvRow(["Uang Masuk", Math.round(report.total_income)]));
    lines.push(csvRow(["Uang Keluar", Math.round(report.total_expense)]));
    lines.push(csvRow(["Saldo Akhir", Math.round(report.closing_balance)]));
  } else {
    const key = kind === "income" ? "income_by_category" : "expense_by_category";
    lines.push(csvRow(["Kategori", "Nominal", "Persentase"]));
    report[key].forEach((c) => lines.push(csvRow([c.name, Math.round(c.amount), `${c.percentage.toFixed(1)}%`])));
  }
  return lines.join("\r\n");
}

// ---------------- PDF (jspdf) ----------------
export function exportPdf(name, period, report, kind, transactions, filename) {
  const doc = new jsPDF();
  const titles = {
    pnl: "Laporan Laba / Rugi",
    cashflow: "Laporan Arus Kas",
    income: "Ringkasan Uang Masuk",
    expense: "Ringkasan Uang Keluar",
    transactions: "Catatan Transaksi",
  };
  doc.setFontSize(18);
  doc.setTextColor("#0F172A");
  doc.text(name, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor("#475569");
  doc.text(`${titles[kind] || "Laporan"}  |  Periode: ${period}`, 14, 28);
  doc.text(`Dibuat: ${stamp()}`, 14, 34);

  let head;
  let body;
  if (kind === "transactions") {
    head = [["Tanggal", "Deskripsi", "Kategori", "Jenis", "Nominal", "Status"]];
    body = (transactions || []).map((t) => [
      t.date || "",
      (t.description || "").slice(0, 38),
      t.category || "",
      t.type === "income" ? "Masuk" : "Keluar",
      rupiah(t.amount),
      t.status || "",
    ]);
  } else if (kind === "pnl") {
    head = [["Keterangan", "Nominal"]];
    body = [
      ["Uang Masuk", rupiah(report.total_income)],
      ["Uang Keluar", rupiah(report.total_expense)],
      ["Laba Bersih", rupiah(report.net_profit)],
    ];
  } else if (kind === "cashflow") {
    head = [["Keterangan", "Nominal"]];
    body = [
      ["Saldo Awal", rupiah(report.opening_balance)],
      ["Uang Masuk", rupiah(report.total_income)],
      ["Uang Keluar", rupiah(report.total_expense)],
      ["Saldo Akhir", rupiah(report.closing_balance)],
    ];
  } else {
    const key = kind === "income" ? "income_by_category" : "expense_by_category";
    head = [["Kategori", "Nominal", "Persentase"]];
    body = report[key].map((c) => [c.name, rupiah(c.amount), `${c.percentage.toFixed(1)}%`]);
  }
  autoTable(doc, {
    startY: 40,
    head,
    body,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  doc.save(filename);
}

// ---------------- Laporan Bulanan lengkap (PDF cantik, 1 klik) ----------------
const C_NAVY = [15, 23, 42];
const C_GREEN = [5, 150, 105];
const C_GREEN2 = [16, 185, 129];
const C_RED = [220, 38, 38];
const C_RED2 = [239, 68, 68];
const C_SLATE = [71, 85, 105];
const C_MUTED = [148, 163, 184];
const C_LIGHT = [241, 245, 249];
const C_ZEBRA = [248, 250, 252];
const C_WHITE = [255, 255, 255];

export function exportMonthlyReportPdf(business, report, monthly, transactions, periodLabel, filename) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;

  // ---- Header band ----
  doc.setFillColor(...C_NAVY);
  doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(...C_GREEN2);
  doc.rect(0, 0, 3, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C_GREEN2);
  doc.text("KASUMKM  \u00B7  LAPORAN BULANAN", M, 12);
  doc.setTextColor(...C_WHITE);
  doc.setFontSize(19);
  doc.text(String(business.name || "-"), M, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  const meta = [business.business_type, business.owner_name].filter(Boolean).join("  \u00B7  ");
  if (meta) doc.text(meta, M, 28);
  doc.setFontSize(9);
  doc.text(`Periode: ${periodLabel}`, W - M, 12, { align: "right" });
  doc.text(`Dibuat: ${stamp()}`, W - M, 17, { align: "right" });

  // ---- KPI cards ----
  let y = 42;
  const gap = 4;
  const cw = (W - 2 * M - 3 * gap) / 4;
  const ch = 22;
  const kpis = [
    ["Saldo Akhir", report.closing_balance, C_NAVY],
    ["Uang Masuk", report.total_income, C_GREEN],
    ["Uang Keluar", report.total_expense, C_RED],
    ["Laba Bersih", report.net_profit, report.net_profit >= 0 ? C_GREEN : C_RED],
  ];
  kpis.forEach(([label, val, color], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(...C_LIGHT);
    doc.roundedRect(x, y, cw, ch, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C_SLATE);
    doc.text(label, x + 4, y + 7.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(rupiah(val), x + 4, y + 16);
  });
  y += ch + 10;

  const sectionTitle = (t) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C_NAVY);
    doc.text(t, M, y);
    y += 2;
  };

  // ---- Grafik batang: 6 bulan terakhir ----
  if (monthly && monthly.length) {
    sectionTitle("Uang Masuk vs Uang Keluar \u2014 6 bulan terakhir");
    const chartY = y + 3;
    const chartW = W - 2 * M;
    const chartH = 40;
    const plotBottom = chartY + chartH;
    // legend (kanan atas area grafik)
    doc.setFontSize(7);
    doc.setFillColor(...C_GREEN2);
    doc.rect(W - M - 46, chartY - 2, 3, 3, "F");
    doc.setTextColor(...C_SLATE);
    doc.text("Masuk", W - M - 41, chartY + 0.6);
    doc.setFillColor(...C_RED2);
    doc.rect(W - M - 24, chartY - 2, 3, 3, "F");
    doc.text("Keluar", W - M - 19, chartY + 0.6);
    // baseline
    doc.setDrawColor(...[226, 232, 240]);
    doc.setLineWidth(0.3);
    doc.line(M, plotBottom, M + chartW, plotBottom);
    const maxVal = Math.max(1, ...monthly.flatMap((m) => [m.income || 0, m.expense || 0]));
    const groupW = chartW / monthly.length;
    const barW = Math.min(9, groupW * 0.26);
    monthly.forEach((m, i) => {
      const gx = M + i * groupW + groupW / 2;
      const hInc = ((m.income || 0) / maxVal) * (chartH - 3);
      const hExp = ((m.expense || 0) / maxVal) * (chartH - 3);
      doc.setFillColor(...C_GREEN2);
      doc.rect(gx - barW - 1, plotBottom - hInc, barW, hInc, "F");
      doc.setFillColor(...C_RED2);
      doc.rect(gx + 1, plotBottom - hExp, barW, hExp, "F");
      doc.setFontSize(7);
      doc.setTextColor(...C_SLATE);
      doc.text(String(m.month), gx, plotBottom + 4.5, { align: "center" });
    });
    y = plotBottom + 12;
  }

  const tableHead = (title, head, body) => {
    sectionTitle(title);
    autoTable(doc, {
      startY: y + 1,
      margin: { left: M, right: M },
      head: [head],
      body,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: C_NAVY, textColor: C_WHITE, halign: "left" },
      alternateRowStyles: { fillColor: C_ZEBRA },
      columnStyles: { [head.length - 1]: { halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 9;
  };

  // ---- Laba / Rugi ----
  tableHead("Laba / Rugi", ["Keterangan", "Nominal"], [
    ["Uang Masuk", rupiah(report.total_income)],
    ["Uang Keluar", rupiah(report.total_expense)],
    ["Laba Bersih", rupiah(report.net_profit)],
    ["Margin Keuntungan", `${(report.profit_margin || 0).toFixed(1)}%`],
  ]);

  // ---- Arus Kas ----
  tableHead("Arus Kas", ["Keterangan", "Nominal"], [
    ["Saldo Awal", rupiah(report.opening_balance)],
    ["Uang Masuk", rupiah(report.total_income)],
    ["Uang Keluar", rupiah(report.total_expense)],
    ["Saldo Akhir", rupiah(report.closing_balance)],
  ]);

  // ---- Rincian per kategori ----
  if ((report.income_by_category || []).length) {
    tableHead(
      "Rincian Uang Masuk per Kategori",
      ["Kategori", "Nominal", "Persentase"],
      report.income_by_category.map((c) => [c.name, rupiah(c.amount), `${c.percentage.toFixed(1)}%`])
    );
  }
  if ((report.expense_by_category || []).length) {
    tableHead(
      "Rincian Uang Keluar per Kategori",
      ["Kategori", "Nominal", "Persentase"],
      report.expense_by_category.map((c) => [c.name, rupiah(c.amount), `${c.percentage.toFixed(1)}%`])
    );
  }

  // ---- Daftar transaksi ----
  sectionTitle(`Daftar Transaksi (${transactions.length})`);
  autoTable(doc, {
    startY: y + 1,
    margin: { left: M, right: M },
    head: [["Tanggal", "Deskripsi", "Kategori", "Jenis", "Nominal"]],
    body: (transactions.length ? transactions : [{ empty: true }]).map((t) =>
      t.empty
        ? ["-", "Belum ada transaksi pada periode ini", "-", "-", "-"]
        : [t.date, (t.description || "-").slice(0, 42), t.category, t.type === "income" ? "Masuk" : "Keluar", rupiah(t.amount)]
    ),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: C_NAVY, textColor: C_WHITE },
    alternateRowStyles: { fillColor: C_ZEBRA },
    columnStyles: { 4: { halign: "right" } },
  });

  // ---- Footer di semua halaman ----
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C_MUTED);
    doc.text("Dibuat dengan KasUMKM \u2014 pembukuan UMKM", M, H - 8);
    doc.text(`Halaman ${p} / ${pages}`, W - M, H - 8, { align: "right" });
  }

  doc.save(filename);
}
