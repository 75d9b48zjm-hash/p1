"""Generator template pembukuan UMKM berbasis Excel (tanpa macro).

Menghasilkan di /app/excel_templates:
  - Pembukuan-Template.xlsx
  - Pembukuan-TokoMaju-Contoh.xlsx
  - Rekap-Admin.xlsx
"""
import os
from datetime import date, timedelta

from openpyxl import Workbook
from openpyxl.chart import BarChart, PieChart, LineChart, Reference
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT_DIR = "/app/excel_templates"
ROWS = 500          # baris data transaksi (2..501)
LAST = ROWS + 1

NAVY = "0F2B46"
TEAL = "0E7C7B"
GOLD = "C8961E"
CREAM = "FBF7EF"
YELLOW = "FFF3C4"
GREY = "F2F4F7"

RP = '"Rp"\\ #,##0'
DATEF = 'dd/mm/yyyy'

INCOME_CATS = ["Penjualan Tunai", "Penjualan Online", "Pendapatan Jasa",
               "Titipan/Konsinyasi", "Pendapatan Lain-lain"]
EXPENSE_CATS = ["Bahan Baku", "Barang Dagang", "Gaji & Upah", "Sewa Tempat",
                "Listrik & Air", "Transport & Kirim", "Kemasan", "Pulsa & Internet",
                "Peralatan", "Promosi", "Pajak & Retribusi", "Pengeluaran Lain-lain"]
METHODS = ["Tunai", "Transfer Bank", "QRIS", "E-wallet", "Lainnya"]
STATUSES = ["Belum Ditinjau", "Disetujui", "Perlu Perbaikan"]

thin = Side(style="thin", color="D6DCE5")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def title_block(ws, text, sub, width=8):
    ws["A1"] = text
    ws["A1"].font = Font(name="Calibri", size=18, bold=True, color=NAVY)
    ws["A2"] = sub
    ws["A2"].font = Font(size=10, italic=True, color="6B7280")
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=width)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=width)
    ws.row_dimensions[1].height = 26


def header_row(ws, row, values, fill=NAVY):
    for i, v in enumerate(values, start=1):
        c = ws.cell(row=row, column=i, value=v)
        c.font = Font(bold=True, color="FFFFFF", size=10)
        c.fill = PatternFill("solid", fgColor=fill)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDER
    ws.row_dimensions[row].height = 28


def kv(ws, row, label, value=None, fmt=None, label_col="A", val_col="B"):
    ws[f"{label_col}{row}"] = label
    ws[f"{label_col}{row}"].font = Font(bold=True, size=10, color=NAVY)
    cell = ws[f"{val_col}{row}"]
    if value is not None:
        cell.value = value
    if fmt:
        cell.number_format = fmt
    cell.fill = PatternFill("solid", fgColor=CREAM)
    cell.border = BORDER
    return cell


# ---------------------------------------------------------------- sheets
def sheet_petunjuk(wb):
    ws = wb.create_sheet("Petunjuk")
    ws.sheet_properties.tabColor = NAVY
    title_block(ws, "Buku Kas UMKM", "Pembukuan sederhana — cukup 4 kolom setiap kali mencatat")
    lines = [
        ("UNTUK PEMILIK USAHA", True),
        ("1. Buka sheet TRANSAKSI (lihat tab di bawah).", False),
        ("2. Isi baris kosong paling bawah: Tanggal, Jenis (Masuk/Keluar), Nominal, Keterangan.", False),
        ("3. Kolom Kategori, Metode Bayar, dan Status BOLEH DIKOSONGKAN — nanti diisi admin.", False),
        ("4. Nominal ditulis angka saja, tanpa Rp dan tanpa titik. Contoh: 150000", False),
        ("5. Punya foto nota? Simpan di Google Drive, tempel tautannya di kolom Tautan Nota.", False),
        ("6. Catat setiap hari, walau hanya satu transaksi. Tidak perlu rapi, yang penting tercatat.", False),
        ("", False),
        ("UNTUK ADMIN / PEMBUKU", True),
        ("1. Baris berwarna kuning = kategori belum diisi. Isi lewat dropdown di kolom Kategori.", False),
        ("2. Setelah benar, ubah Status menjadi 'Disetujui'. Jika ragu, pilih 'Perlu Perbaikan'", False),
        ("   dan tulis pertanyaan di kolom Catatan Admin.", False),
        ("3. Sheet CEK DATA menampilkan baris bermasalah (nominal kosong, tanggal aneh, duplikat).", False),
        ("4. Sheet DASHBOARD: ubah Bulan & Tahun, seluruh angka dan grafik ikut berubah.", False),
        ("5. Akhir bulan: cetak sheet LABA RUGI menjadi PDF dan kirim ke pemilik usaha.", False),
        ("", False),
        ("PENTING", True),
        ("• Jangan menghapus atau memindahkan kolom, karena rumus mengacu ke posisi kolom.", False),
        ("• Kolom J (Bulan) di sheet Transaksi adalah kolom bantu rumus — biarkan saja.", False),
        ("• Kapasitas 500 baris transaksi. Kalau penuh, buat file baru untuk tahun berikutnya.", False),
        ("• Sel rumus dikunci agar tidak tertimpa. Buka lewat Review → Unprotect Sheet (tanpa password).", False),
        ("• Ingin diisi dari HP? Unggah ke Google Drive, buka dengan Google Spreadsheet.", False),
    ]
    r = 4
    for text, is_head in lines:
        c = ws.cell(row=r, column=1, value=text)
        if is_head:
            c.font = Font(bold=True, size=11, color=TEAL)
            ws.row_dimensions[r].height = 22
        else:
            c.font = Font(size=10)
        r += 1
    ws.column_dimensions["A"].width = 105
    return ws


def sheet_profil(wb, profil=None):
    ws = wb.create_sheet("Profil Usaha")
    ws.sheet_properties.tabColor = TEAL
    title_block(ws, "Profil Usaha", "Diisi satu kali oleh admin saat file dibuat", 4)
    p = profil or {}
    kv(ws, 4, "Nama Usaha", p.get("nama", ""))
    kv(ws, 5, "Nama Pemilik", p.get("pemilik", ""))
    kv(ws, 6, "Jenis Usaha", p.get("jenis", ""))
    kv(ws, 7, "No. HP / WhatsApp", p.get("hp", ""))
    kv(ws, 8, "Alamat", p.get("alamat", ""))
    kv(ws, 9, "Modal Awal / Saldo Kas Awal (Rp)", p.get("modal", 0), RP)
    kv(ws, 10, "Bulan Mulai Pembukuan", p.get("mulai", ""))
    kv(ws, 11, "Nama Admin / Pembuku", p.get("admin", ""))
    ws["A13"] = "Catatan: Saldo Kas di Dashboard dihitung dari Modal Awal di atas + seluruh transaksi."
    ws["A13"].font = Font(size=9, italic=True, color="6B7280")
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 40
    return ws


def sheet_kategori(wb):
    ws = wb.create_sheet("Kategori")
    ws.sheet_properties.tabColor = GOLD
    title_block(ws, "Daftar Pilihan (Dropdown)", "Boleh ditambah/diubah sesuai jenis usaha. Isi tanpa baris kosong di tengah.", 6)
    header_row(ws, 4, ["Kategori Pemasukan", "Kategori Pengeluaran", "Metode Bayar", "Status", "Jenis",
                       "Semua Kategori (bantu)"])
    for i, v in enumerate(INCOME_CATS, start=5):
        ws.cell(row=i, column=1, value=v)
    for i, v in enumerate(EXPENSE_CATS, start=5):
        ws.cell(row=i, column=2, value=v)
    for i, v in enumerate(METHODS, start=5):
        ws.cell(row=i, column=3, value=v)
    for i, v in enumerate(STATUSES, start=5):
        ws.cell(row=i, column=4, value=v)
    for i, v in enumerate(["Masuk", "Keluar"], start=5):
        ws.cell(row=i, column=5, value=v)
    # kolom bantu: gabungan kategori (sumber dropdown kategori di sheet Transaksi)
    for i, v in enumerate(INCOME_CATS + EXPENSE_CATS, start=5):
        ws.cell(row=i, column=6, value=v)
    for col, w in zip("ABCDEF", (24, 24, 18, 18, 12, 26)):
        ws.column_dimensions[col].width = w
    for row in ws.iter_rows(min_row=5, max_row=40, min_col=1, max_col=6):
        for c in row:
            c.font = Font(size=10)
            c.border = BORDER
    ws["A42"] = ("Setelah menambah kategori baru, salin juga ke kolom F (Semua Kategori) "
                 "agar muncul di dropdown sheet Transaksi.")
    ws["A42"].font = Font(size=9, italic=True, color="B45309")
    return ws


def sheet_transaksi(wb, rows_data=None):
    ws = wb.create_sheet("Transaksi")
    ws.sheet_properties.tabColor = "1D4ED8"
    cols = ["Tanggal", "Jenis", "Nominal (Rp)", "Keterangan", "Kategori",
            "Metode Bayar", "Status", "Catatan Admin", "Tautan Nota", "Bulan (bantu)"]
    header_row(ws, 1, cols)
    widths = [12, 10, 15, 34, 20, 14, 16, 26, 22, 13]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:J{LAST}"

    for r in range(2, LAST + 1):
        ws.cell(row=r, column=1).number_format = DATEF
        ws.cell(row=r, column=3).number_format = RP
        ws.cell(row=r, column=10, value=f'=IF($A{r}="","",TEXT($A{r},"yyyy-mm"))')
        ws.cell(row=r, column=10).font = Font(size=9, color="9CA3AF")
        for c in range(1, 11):
            ws.cell(row=r, column=c).border = BORDER

    dv_jenis = DataValidation(type="list", formula1="Kategori!$E$5:$E$6", allow_blank=True,
                              errorTitle="Pilihan tidak tersedia",
                              error="Pilih Masuk atau Keluar dari daftar.")
    dv_kat = DataValidation(type="list", formula1="Kategori!$F$5:$F$40", allow_blank=True)
    dv_met = DataValidation(type="list", formula1="Kategori!$C$5:$C$12", allow_blank=True)
    dv_sta = DataValidation(type="list", formula1="Kategori!$D$5:$D$10", allow_blank=True)
    dv_nom = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0",
                            allow_blank=True, errorTitle="Nominal tidak valid",
                            error="Tulis angka saja, tanpa Rp dan tanpa titik.")
    for dv, col in ((dv_jenis, "B"), (dv_nom, "C"), (dv_kat, "E"), (dv_met, "F"), (dv_sta, "G")):
        ws.add_data_validation(dv)
        dv.add(f"{col}2:{col}{LAST}")

    rng = f"A2:J{LAST}"
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=[f'AND($A2<>"",$E2="")'], fill=PatternFill("solid", fgColor=YELLOW), stopIfTrue=False))
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=[f'$G2="Perlu Perbaikan"'], fill=PatternFill("solid", fgColor="FDE2E2")))
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=[f'AND($A2<>"",$C2="")'], fill=PatternFill("solid", fgColor="FFE0B2")))

    if rows_data:
        for i, row in enumerate(rows_data, start=2):
            for j, val in enumerate(row, start=1):
                ws.cell(row=i, column=j, value=val)
            ws.cell(row=i, column=1).number_format = DATEF
            ws.cell(row=i, column=3).number_format = RP
    return ws


def sheet_dashboard(wb, ref_month=None):
    ws = wb.create_sheet("Dashboard")
    ws.sheet_properties.tabColor = "047857"
    title_block(ws, "Dashboard Keuangan", "Ubah Bulan dan Tahun di bawah — semua angka & grafik ikut berubah", 10)

    today = ref_month or date.today()
    kv(ws, 4, "Bulan (1-12)", today.month)
    kv(ws, 5, "Tahun", today.year)
    ws["B4"].font = Font(bold=True, size=12, color=NAVY)
    ws["B5"].font = Font(bold=True, size=12, color=NAVY)
    ws["A6"] = "Kunci Bulan"
    ws["A6"].font = Font(size=9, color="9CA3AF")
    ws["B6"] = '=TEXT(DATE($B$5,$B$4,1),"yyyy-mm")'
    ws["B6"].font = Font(size=9, color="9CA3AF")
    ws["C4"] = ('=CHOOSE($B$4,"Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus",'
                '"September","Oktober","November","Desember")&" "&$B$5')
    ws["C4"].font = Font(bold=True, size=13, color=TEAL)

    masuk = f'SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,$B$6,Transaksi!$B:$B,"Masuk")'
    keluar = f'SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,$B$6,Transaksi!$B:$B,"Keluar")'
    cards = [
        (8, "Uang Masuk Bulan Ini", f"={masuk}", "D1FAE5"),
        (9, "Uang Keluar Bulan Ini", f"={keluar}", "FEE2E2"),
        (10, "Laba / Rugi Bulan Ini", "=B8-B9", "DBEAFE"),
        (11, "Saldo Kas s/d Akhir Bulan",
         "='Profil Usaha'!$B$9"
         '+SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,"<="&$B$6,Transaksi!$B:$B,"Masuk")'
         '-SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,"<="&$B$6,Transaksi!$B:$B,"Keluar")', "FEF3C7"),
        (12, "Jumlah Transaksi Bulan Ini",
         '=COUNTIFS(Transaksi!$J:$J,$B$6)', GREY),
        (13, "Belum Dikategorikan (perlu admin)",
         '=COUNTIFS(Transaksi!$J:$J,$B$6,Transaksi!$E:$E,"")', YELLOW),
        (14, "Transaksi Terakhir Dicatat",
         '=IF(COUNT(Transaksi!$A:$A)=0,"-",MAX(Transaksi!$A:$A))', GREY),
    ]
    for r, label, formula, color in cards:
        ws[f"A{r}"] = label
        ws[f"A{r}"].font = Font(bold=True, size=10, color=NAVY)
        c = ws[f"B{r}"]
        c.value = formula
        c.fill = PatternFill("solid", fgColor=color)
        c.border = BORDER
        c.font = Font(bold=True, size=11)
        c.number_format = RP if r <= 11 else ('dd/mm/yyyy' if r == 14 else '#,##0')

    # tabel 12 bulan (sumber grafik)
    header_row(ws, 17, ["Bulan", "Uang Masuk", "Uang Keluar", "Laba/Rugi", "Kunci"], fill=TEAL)
    for i in range(12):
        r = 18 + i
        ws.cell(row=r, column=1, value=f'=CHOOSE({i+1},"Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu",'
                                       f'"Sep","Okt","Nov","Des")')
        ws.cell(row=r, column=5, value=f'=TEXT(DATE($B$5,{i+1},1),"yyyy-mm")')
        ws.cell(row=r, column=2,
                value=f'=SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,$E{r},Transaksi!$B:$B,"Masuk")')
        ws.cell(row=r, column=3,
                value=f'=SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,$E{r},Transaksi!$B:$B,"Keluar")')
        ws.cell(row=r, column=4, value=f"=$B{r}-$C{r}")
        for col in (2, 3, 4):
            ws.cell(row=r, column=col).number_format = RP
        ws.cell(row=r, column=5).font = Font(size=9, color="D1D5DB")
        for col in range(1, 6):
            ws.cell(row=r, column=col).border = BORDER

    # tabel pengeluaran per kategori (sumber grafik pie)
    start = 33
    header_row(ws, start, ["Kategori Pengeluaran", "Jumlah Bulan Ini"], fill=GOLD)
    for i in range(len(EXPENSE_CATS)):
        r = start + 1 + i
        kat_row = 5 + i
        ws.cell(row=r, column=1, value=f"=Kategori!$B${kat_row}")
        ws.cell(row=r, column=2,
                value=f'=SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,$B$6,Transaksi!$B:$B,"Keluar",'
                      f'Transaksi!$E:$E,$A{r})')
        ws.cell(row=r, column=2).number_format = RP
        for col in (1, 2):
            ws.cell(row=r, column=col).border = BORDER
    end_pie = start + len(EXPENSE_CATS)

    bar = BarChart()
    bar.type = "col"
    bar.title = "Uang Masuk vs Uang Keluar per Bulan"
    bar.y_axis.title = "Rupiah"
    bar.height, bar.width = 8.5, 19
    data = Reference(ws, min_col=2, max_col=3, min_row=17, max_row=29)
    cats = Reference(ws, min_col=1, min_row=18, max_row=29)
    bar.add_data(data, titles_from_data=True)
    bar.set_categories(cats)
    ws.add_chart(bar, "G8")

    line = LineChart()
    line.title = "Tren Laba / Rugi per Bulan"
    line.height, line.width = 7.5, 19
    line.add_data(Reference(ws, min_col=4, min_row=17, max_row=29), titles_from_data=True)
    line.set_categories(cats)
    ws.add_chart(line, "G26")

    pie = PieChart()
    pie.title = "Komposisi Pengeluaran Bulan Ini"
    pie.height, pie.width = 9, 12
    pie.add_data(Reference(ws, min_col=2, min_row=start, max_row=end_pie), titles_from_data=True)
    pie.set_categories(Reference(ws, min_col=1, min_row=start + 1, max_row=end_pie))
    ws.add_chart(pie, "G45")

    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 20
    ws.column_dimensions["C"].width = 20
    ws.column_dimensions["D"].width = 18
    ws.column_dimensions["E"].width = 11
    ws.protection.enable()
    for cell in ("B4", "B5"):
        ws[cell].protection = ws[cell].protection.copy(locked=False)
    return ws


def sheet_laba_rugi(wb):
    ws = wb.create_sheet("Laba Rugi")
    ws.sheet_properties.tabColor = "6D28D9"
    title_block(ws, "Laporan Laba Rugi", "Bulan mengikuti pilihan di sheet Dashboard. Siap dicetak / disimpan sebagai PDF.", 4)
    ws["A3"] = ('="Periode: "&CHOOSE(Dashboard!$B$4,"Januari","Februari","Maret","April","Mei","Juni",'
                '"Juli","Agustus","September","Oktober","November","Desember")&" "&Dashboard!$B$5')
    ws["A3"].font = Font(bold=True, size=12, color=TEAL)
    ws["A4"] = "='Profil Usaha'!$B$4"
    ws["A4"].font = Font(bold=True, size=11)

    r = 6
    header_row(ws, r, ["PEMASUKAN", "Jumlah (Rp)"], fill=TEAL)
    r += 1
    inc_start = r
    for i in range(len(INCOME_CATS)):
        ws.cell(row=r, column=1, value=f"=Kategori!$A${5+i}")
        ws.cell(row=r, column=2,
                value='=SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,Dashboard!$B$6,'
                      f'Transaksi!$B:$B,"Masuk",Transaksi!$E:$E,$A{r})')
        ws.cell(row=r, column=2).number_format = RP
        r += 1
    ws.cell(row=r, column=1, value="Belum dikategorikan")
    ws.cell(row=r, column=2,
            value='=SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,Dashboard!$B$6,'
                  'Transaksi!$B:$B,"Masuk",Transaksi!$E:$E,"")')
    ws.cell(row=r, column=2).number_format = RP
    inc_end = r
    r += 1
    ws.cell(row=r, column=1, value="TOTAL PEMASUKAN").font = Font(bold=True, color=NAVY)
    tot_inc = r
    ws.cell(row=r, column=2, value=f"=SUM(B{inc_start}:B{inc_end})")
    ws.cell(row=r, column=2).number_format = RP
    ws.cell(row=r, column=2).font = Font(bold=True)
    ws.cell(row=r, column=2).fill = PatternFill("solid", fgColor="D1FAE5")

    r += 2
    header_row(ws, r, ["PENGELUARAN", "Jumlah (Rp)"], fill=GOLD)
    r += 1
    exp_start = r
    for i in range(len(EXPENSE_CATS)):
        ws.cell(row=r, column=1, value=f"=Kategori!$B${5+i}")
        ws.cell(row=r, column=2,
                value='=SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,Dashboard!$B$6,'
                      f'Transaksi!$B:$B,"Keluar",Transaksi!$E:$E,$A{r})')
        ws.cell(row=r, column=2).number_format = RP
        r += 1
    ws.cell(row=r, column=1, value="Belum dikategorikan")
    ws.cell(row=r, column=2,
            value='=SUMIFS(Transaksi!$C:$C,Transaksi!$J:$J,Dashboard!$B$6,'
                  'Transaksi!$B:$B,"Keluar",Transaksi!$E:$E,"")')
    ws.cell(row=r, column=2).number_format = RP
    exp_end = r
    r += 1
    ws.cell(row=r, column=1, value="TOTAL PENGELUARAN").font = Font(bold=True, color=NAVY)
    tot_exp = r
    ws.cell(row=r, column=2, value=f"=SUM(B{exp_start}:B{exp_end})")
    ws.cell(row=r, column=2).number_format = RP
    ws.cell(row=r, column=2).font = Font(bold=True)
    ws.cell(row=r, column=2).fill = PatternFill("solid", fgColor="FEE2E2")

    r += 2
    ws.cell(row=r, column=1, value="LABA / RUGI BERSIH").font = Font(bold=True, size=12, color="FFFFFF")
    ws.cell(row=r, column=1).fill = PatternFill("solid", fgColor=NAVY)
    c = ws.cell(row=r, column=2, value=f"=B{tot_inc}-B{tot_exp}")
    c.number_format = RP
    c.font = Font(bold=True, size=12, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor=NAVY)
    r += 2
    ws.cell(row=r, column=1, value="Margin Laba (%)")
    ws.cell(row=r, column=2, value=f"=IF(B{tot_inc}=0,0,(B{tot_inc}-B{tot_exp})/B{tot_inc})")
    ws.cell(row=r, column=2).number_format = '0.0%'

    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 20
    ws.print_area = f"A1:B{r}"
    ws.page_setup.orientation = "portrait"
    ws.protection.enable()
    return ws


def sheet_arus_kas(wb):
    ws = wb.create_sheet("Arus Kas Harian")
    ws.sheet_properties.tabColor = "0369A1"
    title_block(ws, "Arus Kas Harian", "Mengikuti Bulan & Tahun di sheet Dashboard", 5)
    header_row(ws, 4, ["Tanggal", "Uang Masuk", "Uang Keluar", "Selisih Hari Ini", "Saldo Berjalan"], fill=TEAL)
    for i in range(31):
        r = 5 + i
        ws.cell(row=r, column=1,
                value=f'=IF({i+1}>DAY(EOMONTH(DATE(Dashboard!$B$5,Dashboard!$B$4,1),0)),"",'
                      f'DATE(Dashboard!$B$5,Dashboard!$B$4,{i+1}))')
        ws.cell(row=r, column=1).number_format = DATEF
        ws.cell(row=r, column=2,
                value=f'=IF($A{r}="","",SUMIFS(Transaksi!$C:$C,Transaksi!$A:$A,$A{r},Transaksi!$B:$B,"Masuk"))')
        ws.cell(row=r, column=3,
                value=f'=IF($A{r}="","",SUMIFS(Transaksi!$C:$C,Transaksi!$A:$A,$A{r},Transaksi!$B:$B,"Keluar"))')
        ws.cell(row=r, column=4, value=f'=IF($A{r}="","",$B{r}-$C{r})')
        if i == 0:
            saldo = ('=IF($A5="","",\'Profil Usaha\'!$B$9'
                     '+SUMIFS(Transaksi!$C:$C,Transaksi!$A:$A,"<"&$A5,Transaksi!$B:$B,"Masuk")'
                     '-SUMIFS(Transaksi!$C:$C,Transaksi!$A:$A,"<"&$A5,Transaksi!$B:$B,"Keluar")+$D5)')
        else:
            saldo = f'=IF($A{r}="","",$E{r-1}+$D{r})'
        ws.cell(row=r, column=5, value=saldo)
        for col in range(2, 6):
            ws.cell(row=r, column=col).number_format = RP
        for col in range(1, 6):
            ws.cell(row=r, column=col).border = BORDER
    r = 37
    ws.cell(row=r, column=1, value="TOTAL BULAN").font = Font(bold=True, color=NAVY)
    for col in (2, 3, 4):
        cl = get_column_letter(col)
        ws.cell(row=r, column=col, value=f"=SUM({cl}5:{cl}35)")
        ws.cell(row=r, column=col).number_format = RP
        ws.cell(row=r, column=col).font = Font(bold=True)
    for col, w in zip("ABCDE", (14, 18, 18, 18, 20)):
        ws.column_dimensions[col].width = w
    ws.protection.enable()
    return ws


def sheet_cek_data(wb):
    ws = wb.create_sheet("Cek Data")
    ws.sheet_properties.tabColor = "B91C1C"
    title_block(ws, "Cek Data", "Gunakan Filter di kolom Masalah → hilangkan centang (Kosong) untuk melihat "
                                "hanya baris yang perlu diperbaiki", 5)
    ws["A4"] = "Ringkasan"
    ws["A4"].font = Font(bold=True, color=NAVY)
    kv(ws, 5, "Baris tanpa kategori", '=COUNTIFS(Transaksi!$A$2:$A$501,"<>",Transaksi!$E$2:$E$501,"")', '#,##0')
    kv(ws, 6, "Baris tanpa nominal", '=COUNTIFS(Transaksi!$A$2:$A$501,"<>",Transaksi!$C$2:$C$501,"")', '#,##0')
    kv(ws, 7, "Baris belum disetujui", '=COUNTIFS(Transaksi!$A$2:$A$501,"<>",Transaksi!$G$2:$G$501,"<>Disetujui")', '#,##0')
    kv(ws, 8, "Total baris terisi", '=COUNTA(Transaksi!$A$2:$A$501)', '#,##0')

    header_row(ws, 10, ["Baris di Transaksi", "Tanggal", "Nominal", "Keterangan", "Masalah"], fill="B91C1C")
    ws.auto_filter.ref = f"A10:E{10 + ROWS}"
    for i in range(ROWS):
        r = 11 + i
        tr = 2 + i
        ws.cell(row=r, column=1, value=f'=IF(Transaksi!$A{tr}="","",{tr})')
        ws.cell(row=r, column=2, value=f'=IF(Transaksi!$A{tr}="","",Transaksi!$A{tr})')
        ws.cell(row=r, column=2).number_format = DATEF
        ws.cell(row=r, column=3, value=f'=IF(Transaksi!$A{tr}="","",Transaksi!$C{tr})')
        ws.cell(row=r, column=3).number_format = RP
        ws.cell(row=r, column=4, value=f'=IF(Transaksi!$A{tr}="","",Transaksi!$D{tr})')
        masalah = (
            f'=IF(Transaksi!$A{tr}="","",TRIM('
            f'IF(Transaksi!$C{tr}="","Nominal kosong. ","")&'
            f'IF(N(Transaksi!$C{tr})<0,"Nominal negatif. ","")&'
            f'IF(Transaksi!$B{tr}="","Jenis belum diisi. ","")&'
            f'IF(Transaksi!$E{tr}="","Kategori belum diisi. ","")&'
            f'IF(Transaksi!$A{tr}>TODAY(),"Tanggal di masa depan. ","")&'
            f'IF(COUNTIFS(Transaksi!$A$2:$A$501,Transaksi!$A{tr},Transaksi!$C$2:$C$501,Transaksi!$C{tr},'
            f'Transaksi!$D$2:$D$501,Transaksi!$D{tr})>1,"Kemungkinan duplikat. ","")))'
        )
        ws.cell(row=r, column=5, value=masalah)
        for col in range(1, 6):
            ws.cell(row=r, column=col).border = BORDER
    ws.conditional_formatting.add(f"A11:E{10+ROWS}", FormulaRule(
        formula=['AND($E11<>"",$A11<>"")'], fill=PatternFill("solid", fgColor="FEE2E2")))
    for col, w in zip("ABCDE", (18, 13, 15, 32, 58)):
        ws.column_dimensions[col].width = w
    ws.protection.enable()
    return ws


def sheet_contoh(wb, rows):
    ws = wb.create_sheet("Contoh Pengisian")
    ws.sheet_properties.tabColor = "9CA3AF"
    title_block(ws, "Contoh Pengisian", "Hanya contoh. Sheet ini boleh dihapus.", 6)
    header_row(ws, 4, ["Tanggal", "Jenis", "Nominal (Rp)", "Keterangan", "Kategori (oleh admin)", "Status"], fill="6B7280")
    for i, row in enumerate(rows, start=5):
        for j, v in enumerate(row, start=1):
            ws.cell(row=i, column=j, value=v)
        ws.cell(row=i, column=1).number_format = DATEF
        ws.cell(row=i, column=3).number_format = RP
        for j in range(1, 7):
            ws.cell(row=i, column=j).border = BORDER
    for col, w in zip("ABCDEF", (13, 10, 15, 34, 22, 16)):
        ws.column_dimensions[col].width = w
    ws["A22"] = ("Perhatikan: kolom Kategori dan Status boleh kosong saat pemilik usaha mencatat. "
                 "Admin yang melengkapi kemudian.")
    ws["A22"].font = Font(size=9, italic=True, color="6B7280")
    return ws


def fit_print(ws, landscape=False):
    from openpyxl.worksheet.properties import PageSetupProperties
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    if landscape:
        ws.page_setup.orientation = "landscape"


def build_umkm_file(path, profil=None, transaksi=None, ref_month=None):
    wb = Workbook()
    wb.remove(wb.active)
    sheet_petunjuk(wb)
    sheet_profil(wb, profil)
    sheet_transaksi(wb, transaksi)
    sheet_dashboard(wb, ref_month)
    sheet_laba_rugi(wb)
    sheet_arus_kas(wb)
    sheet_kategori(wb)
    sheet_cek_data(wb)
    sheet_contoh(wb, CONTOH_ROWS)
    for name in wb.sheetnames:
        fit_print(wb[name], landscape=name in ("Transaksi", "Cek Data", "Dashboard"))
    wb.properties.creator = "KasUMKM"
    wb.properties.title = "Pembukuan UMKM"
    wb.save(path)


# ---------------------------------------------------------------- rekap admin
def build_admin_file(path, businesses):
    wb = Workbook()
    wb.remove(wb.active)

    ws = wb.create_sheet("Petunjuk")
    ws.sheet_properties.tabColor = NAVY
    title_block(ws, "Rekap Admin — Semua UMKM", "Satu file untuk memantau seluruh klien pembukuan Anda")
    steps = [
        "1. Buka file Pembukuan-<NamaUsaha>.xlsx → sheet Transaksi.",
        "2. Blok data dari kolom Tanggal sampai Status (tanpa baris judul), lalu Copy.",
        "3. Buka sheet SALIN DATA di file ini, tempel (Paste) di baris kosong paling bawah kolom B.",
        "4. Tulis nama usaha di kolom A untuk baris-baris yang baru ditempel.",
        "5. Sheet REKAP otomatis membandingkan seluruh UMKM.",
        "6. Sheet TAGIHAN JASA otomatis menghitung biaya jasa pembukuan bulan itu.",
        "",
        "Tips: lakukan setiap akhir minggu supaya rekap tidak menumpuk.",
        "Kolom I (Bulan) di sheet Salin Data adalah kolom bantu rumus — biarkan saja.",
        "Daftar nama usaha di sheet Rekap harus ditulis SAMA PERSIS dengan di kolom A sheet Salin Data.",
    ]
    r = 4
    for s in steps:
        ws.cell(row=r, column=1, value=s).font = Font(size=10)
        r += 1
    ws.column_dimensions["A"].width = 100

    ds = wb.create_sheet("Salin Data")
    ds.sheet_properties.tabColor = "1D4ED8"
    header_row(ds, 1, ["Nama Usaha", "Tanggal", "Jenis", "Nominal (Rp)", "Keterangan",
                       "Kategori", "Metode Bayar", "Status", "Bulan (bantu)"])
    ds.freeze_panes = "A2"
    ds.auto_filter.ref = "A1:I2001"
    for r in range(2, 2002):
        ds.cell(row=r, column=2).number_format = DATEF
        ds.cell(row=r, column=4).number_format = RP
        ds.cell(row=r, column=9, value=f'=IF($B{r}="","",TEXT($B{r},"yyyy-mm"))')
        ds.cell(row=r, column=9).font = Font(size=9, color="D1D5DB")
    dv = DataValidation(type="list", formula1='"Masuk,Keluar"', allow_blank=True)
    ds.add_data_validation(dv)
    dv.add("C2:C2001")
    for col, w in zip("ABCDEFGHI", (22, 12, 10, 15, 32, 20, 14, 16, 13)):
        ds.column_dimensions[col].width = w

    rk = wb.create_sheet("Rekap")
    rk.sheet_properties.tabColor = "047857"
    title_block(rk, "Rekap Semua UMKM", "Ubah Bulan & Tahun di bawah", 9)
    kv(rk, 4, "Bulan (1-12)", date.today().month)
    kv(rk, 5, "Tahun", date.today().year)
    rk["C4"] = ('=CHOOSE($B$4,"Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus",'
                '"September","Oktober","November","Desember")&" "&$B$5')
    rk["C4"].font = Font(bold=True, size=13, color=TEAL)
    rk["A6"] = "Kunci Bulan"
    rk["A6"].font = Font(size=9, color="9CA3AF")
    rk["B6"] = '=TEXT(DATE($B$5,$B$4,1),"yyyy-mm")'
    rk["B6"].font = Font(size=9, color="9CA3AF")

    header_row(rk, 8, ["Nama Usaha", "Uang Masuk", "Uang Keluar", "Laba / Rugi", "Jumlah Transaksi",
                       "Belum Dikategorikan", "Belum Disetujui", "Transaksi Terakhir",
                       "Hari Tidak Mencatat"], fill=TEAL)
    for i in range(20):
        r = 9 + i
        rk.cell(row=r, column=1, value=businesses[i] if i < len(businesses) else None)
        rk.cell(row=r, column=2,
                value=f'=IF($A{r}="","",SUMIFS(\'Salin Data\'!$D:$D,\'Salin Data\'!$A:$A,$A{r},'
                      f'\'Salin Data\'!$I:$I,$B$6,\'Salin Data\'!$C:$C,"Masuk"))')
        rk.cell(row=r, column=3,
                value=f'=IF($A{r}="","",SUMIFS(\'Salin Data\'!$D:$D,\'Salin Data\'!$A:$A,$A{r},'
                      f'\'Salin Data\'!$I:$I,$B$6,\'Salin Data\'!$C:$C,"Keluar"))')
        rk.cell(row=r, column=4, value=f'=IF($A{r}="","",$B{r}-$C{r})')
        rk.cell(row=r, column=5,
                value=f'=IF($A{r}="","",COUNTIFS(\'Salin Data\'!$A:$A,$A{r},\'Salin Data\'!$I:$I,$B$6))')
        rk.cell(row=r, column=6,
                value=f'=IF($A{r}="","",COUNTIFS(\'Salin Data\'!$A:$A,$A{r},\'Salin Data\'!$I:$I,$B$6,'
                      f'\'Salin Data\'!$F:$F,""))')
        rk.cell(row=r, column=7,
                value=f'=IF($A{r}="","",COUNTIFS(\'Salin Data\'!$A:$A,$A{r},\'Salin Data\'!$I:$I,$B$6,'
                      f'\'Salin Data\'!$H:$H,"<>Disetujui"))')
        rk.cell(row=r, column=8,
                value=f'=IF($A{r}="","",IF(COUNTIF(\'Salin Data\'!$A:$A,$A{r})=0,"-",'
                      f'SUMPRODUCT(MAX((\'Salin Data\'!$A$2:$A$2001=$A{r})*\'Salin Data\'!$B$2:$B$2001))))')
        rk.cell(row=r, column=9,
                value=f'=IF(OR($A{r}="",NOT(ISNUMBER($H{r}))),"",TODAY()-$H{r})')
        for col in (2, 3, 4):
            rk.cell(row=r, column=col).number_format = RP
        rk.cell(row=r, column=8).number_format = DATEF
        rk.cell(row=r, column=9).number_format = '0'
        for col in range(1, 10):
            rk.cell(row=r, column=col).border = BORDER
    rk.cell(row=30, column=1, value="TOTAL SEMUA UMKM").font = Font(bold=True, color=NAVY)
    for col in (2, 3, 4, 5, 6, 7):
        cl = get_column_letter(col)
        c = rk.cell(row=30, column=col, value=f"=SUM({cl}9:{cl}28)")
        c.font = Font(bold=True)
        c.number_format = RP if col <= 4 else '#,##0'
    rk.conditional_formatting.add("A9:I28", FormulaRule(
        formula=['AND($I9<>"",$I9>=3)'], fill=PatternFill("solid", fgColor="FEE2E2")))
    rk.conditional_formatting.add("A9:I28", FormulaRule(
        formula=['AND($F9<>"",$F9>0)'], fill=PatternFill("solid", fgColor=YELLOW)))
    rk["A32"] = ("Merah = sudah 3 hari atau lebih tidak mencatat (perlu diingatkan). "
                 "Kuning = masih ada transaksi yang belum dikategorikan. "
                 "Nama usaha di kolom A harus ditulis sama persis dengan di sheet Salin Data.")
    rk["A32"].font = Font(size=9, italic=True, color="6B7280")
    for col, w in zip("ABCDEFGHI", (24, 17, 17, 17, 15, 18, 16, 16, 16)):
        rk.column_dimensions[col].width = w

    chart = BarChart()
    chart.type = "col"
    chart.title = "Laba / Rugi per UMKM (bulan terpilih)"
    chart.height, chart.width = 8, 18
    chart.add_data(Reference(rk, min_col=4, min_row=8, max_row=28), titles_from_data=True)
    chart.set_categories(Reference(rk, min_col=1, min_row=9, max_row=28))
    rk.add_chart(chart, "K8")

    tg = wb.create_sheet("Tagihan Jasa")
    tg.sheet_properties.tabColor = GOLD
    title_block(tg, "Tagihan Jasa Pembukuan", "Bulan mengikuti sheet Rekap", 7)
    kv(tg, 4, "Tarif Dasar per UMKM / bulan (Rp)", 50000, RP)
    kv(tg, 5, "Batas Transaksi Termasuk Tarif Dasar", 100, '#,##0')
    kv(tg, 6, "Biaya Tambahan per Transaksi Kelebihan (Rp)", 300, RP)
    tg["C4"] = ('=CHOOSE(Rekap!$B$4,"Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus",'
                '"September","Oktober","November","Desember")&" "&Rekap!$B$5')
    tg["C4"].font = Font(bold=True, size=12, color=TEAL)
    header_row(tg, 8, ["Nama Usaha", "Jumlah Transaksi", "Kelebihan Transaksi", "Tarif Dasar",
                       "Biaya Tambahan", "Total Tagihan", "Status Bayar"], fill=GOLD)
    for i in range(20):
        r = 9 + i
        src = 9 + i
        tg.cell(row=r, column=1, value=f'=IF(Rekap!$A{src}="","",Rekap!$A{src})')
        tg.cell(row=r, column=2, value=f'=IF($A{r}="","",Rekap!$E{src})')
        tg.cell(row=r, column=3, value=f'=IF($A{r}="","",MAX(0,$B{r}-$B$5))')
        tg.cell(row=r, column=4, value=f'=IF($A{r}="","",IF($B{r}=0,0,$B$4))')
        tg.cell(row=r, column=5, value=f'=IF($A{r}="","",$C{r}*$B$6)')
        tg.cell(row=r, column=6, value=f'=IF($A{r}="","",$D{r}+$E{r})')
        for col in (4, 5, 6):
            tg.cell(row=r, column=col).number_format = RP
        for col in range(1, 8):
            tg.cell(row=r, column=col).border = BORDER
    dvb = DataValidation(type="list", formula1='"Belum Bayar,Sudah Bayar"', allow_blank=True)
    tg.add_data_validation(dvb)
    dvb.add("G9:G28")
    tg.cell(row=30, column=1, value="TOTAL PENDAPATAN JASA").font = Font(bold=True, color=NAVY)
    c = tg.cell(row=30, column=6, value="=SUM(F9:F28)")
    c.number_format = RP
    c.font = Font(bold=True, size=12)
    c.fill = PatternFill("solid", fgColor="D1FAE5")
    tg.cell(row=31, column=1, value="Sudah dibayar")
    tg.cell(row=31, column=6, value='=SUMIFS($F$9:$F$28,$G$9:$G$28,"Sudah Bayar")').number_format = RP
    tg.cell(row=32, column=1, value="Belum dibayar")
    tg.cell(row=32, column=6, value="=F30-F31").number_format = RP
    for col, w in zip("ABCDEFG", (26, 18, 20, 16, 18, 18, 16)):
        tg.column_dimensions[col].width = w

    for name in wb.sheetnames:
        fit_print(wb[name], landscape=name in ("Salin Data", "Rekap", "Tagihan Jasa"))
    wb.properties.creator = "KasUMKM"
    wb.save(path)


# ---------------------------------------------------------------- data contoh
CONTOH_ROWS = [
    (date(2026, 6, 1), "Masuk", 450000, "penjualan hari ini", "Penjualan Tunai", "Disetujui"),
    (date(2026, 6, 1), "Keluar", 150000, "beli gula 5 kg", "Bahan Baku", "Disetujui"),
    (date(2026, 6, 2), "Masuk", 380000, "jualan", None, None),
    (date(2026, 6, 2), "Keluar", 25000, "bensin antar pesanan", None, None),
    (date(2026, 6, 3), "Masuk", 620000, "pesanan katering 20 box", "Pendapatan Jasa", "Disetujui"),
    (date(2026, 6, 3), "Keluar", 300000, "belanja pasar", "Bahan Baku", "Disetujui"),
    (date(2026, 6, 4), "Keluar", 500000, "bayar listrik", "Listrik & Air", "Disetujui"),
]


def sample_transactions():
    """±1,5 bulan transaksi contoh untuk Toko Maju."""
    import random
    random.seed(7)
    rows = []
    start = date(2026, 5, 1)
    for d in range(0, 61):
        day = start + timedelta(days=d)
        # pemasukan harian
        for _ in range(random.choice([1, 1, 2])):
            amount = random.randrange(150, 900) * 1000
            kat = random.choice(["Penjualan Tunai", "Penjualan Tunai", "Penjualan Online"])
            ket = random.choice(["penjualan harian", "jualan warung", "pesanan online",
                                 "jualan sore", "penjualan tunai kasir"])
            reviewed = day < date(2026, 6, 20)
            rows.append([day, "Masuk", amount, ket,
                         kat if reviewed else None,
                         "Tunai" if reviewed else None,
                         "Disetujui" if reviewed else None, None, None])
        # pengeluaran
        if random.random() < 0.8:
            pilihan = [("beli bahan baku", "Bahan Baku"), ("belanja pasar", "Bahan Baku"),
                       ("bensin motor kirim", "Transport & Kirim"), ("beli plastik kemasan", "Kemasan"),
                       ("pulsa internet", "Pulsa & Internet"), ("beli stok minuman", "Barang Dagang")]
            ket, kat = random.choice(pilihan)
            amount = random.randrange(20, 350) * 1000
            reviewed = day < date(2026, 6, 20)
            rows.append([day, "Keluar", amount, ket,
                         kat if reviewed else None,
                         "Tunai" if reviewed else None,
                         "Disetujui" if reviewed else None, None, None])
        if day.day == 5:
            rows.append([day, "Keluar", 1500000, "gaji karyawan", "Gaji & Upah", "Transfer Bank",
                         "Disetujui", None, None])
            rows.append([day, "Keluar", 1000000, "sewa kios", "Sewa Tempat", "Transfer Bank",
                         "Disetujui", None, None])
        if day.day == 10:
            rows.append([day, "Keluar", 320000, "bayar listrik & air", "Listrik & Air", "Transfer Bank",
                         "Disetujui", None, None])
    rows.sort(key=lambda x: x[0])
    return rows


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    build_umkm_file(f"{OUT_DIR}/Pembukuan-Template.xlsx",
                    profil={"mulai": "", "admin": ""})
    build_umkm_file(
        f"{OUT_DIR}/Pembukuan-TokoMaju-Contoh.xlsx",
        profil={"nama": "Toko Maju", "pemilik": "Bu Siti", "jenis": "Warung / Toko Kelontong",
                "hp": "0812-3456-7890", "alamat": "Jl. Merdeka No. 12", "modal": 5000000,
                "mulai": "Mei 2026", "admin": "Admin KasUMKM"},
        transaksi=sample_transactions(), ref_month=date(2026, 6, 1))
    build_admin_file(f"{OUT_DIR}/Rekap-Admin.xlsx",
                     ["Toko Maju", "Kedai Nusantara", "Laundry Bersih", "Sinar Jaya Online",
                      "Kreatif Digital"])
    for f in sorted(os.listdir(OUT_DIR)):
        print(f, os.path.getsize(os.path.join(OUT_DIR, f)), "bytes")


if __name__ == "__main__":
    main()
