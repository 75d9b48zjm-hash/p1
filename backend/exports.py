import io
import csv
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer


def rupiah(v) -> str:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return "Rp0"
    sign = "-" if n < 0 else ""
    return f"{sign}Rp{abs(int(round(n))):,}".replace(",", ".")


def transactions_csv(rows: list) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Tanggal", "Deskripsi", "Kategori", "Jenis", "Nominal", "Metode Pembayaran", "Status"])
    for t in rows:
        w.writerow([
            t.get("date", ""), t.get("description", ""), t.get("category", ""),
            "Uang Masuk" if t.get("type") == "income" else "Uang Keluar",
            int(round(t.get("amount", 0))), t.get("payment_method", ""), t.get("status", ""),
        ])
    return buf.getvalue().encode("utf-8-sig")


def report_csv(business_name: str, period: str, report: dict, kind: str) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([business_name])
    w.writerow([f"Periode: {period}"])
    w.writerow([f"Dibuat: {datetime.now().strftime('%d-%m-%Y %H:%M')}"])
    w.writerow([])
    if kind == "pnl":
        w.writerow(["Laba / Rugi"])
        w.writerow(["Uang Masuk", int(report["total_income"])])
        w.writerow(["Uang Keluar", int(report["total_expense"])])
        w.writerow(["Laba Bersih", int(report["net_profit"])])
    elif kind == "cashflow":
        w.writerow(["Arus Kas"])
        w.writerow(["Saldo Awal", int(report["opening_balance"])])
        w.writerow(["Uang Masuk", int(report["total_income"])])
        w.writerow(["Uang Keluar", int(report["total_expense"])])
        w.writerow(["Saldo Akhir", int(report["closing_balance"])])
    else:
        key = "income_by_category" if kind == "income" else "expense_by_category"
        w.writerow(["Kategori", "Nominal", "Persentase"])
        for r in report[key]:
            w.writerow([r["name"], int(r["amount"]), f"{r['percentage']:.1f}%"])
    return buf.getvalue().encode("utf-8-sig")


def build_pdf(business_name: str, period: str, report: dict, kind: str, transactions=None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], fontSize=18, textColor=colors.HexColor("#0F172A"))
    sub = ParagraphStyle("s", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#475569"))
    titles = {"pnl": "Laporan Laba / Rugi", "cashflow": "Laporan Arus Kas",
              "income": "Ringkasan Uang Masuk", "expense": "Ringkasan Uang Keluar",
              "transactions": "Catatan Transaksi"}
    story = [Paragraph(business_name, title),
             Paragraph(f"{titles.get(kind, 'Laporan')} &nbsp;|&nbsp; Periode: {period}", sub),
             Paragraph(f"Dibuat: {datetime.now().strftime('%d-%m-%Y %H:%M')}", sub),
             Spacer(1, 10 * mm)]

    def styled(data, widths):
        t = Table(data, colWidths=widths, hAlign="LEFT")
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ECFDF5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#065F46")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
        ]))
        return t

    if kind == "transactions":
        data = [["Tanggal", "Deskripsi", "Kategori", "Jenis", "Nominal", "Status"]]
        for t in (transactions or []):
            data.append([t.get("date"), (t.get("description") or "")[:38], t.get("category"),
                         "Masuk" if t["type"] == "income" else "Keluar",
                         rupiah(t.get("amount")), t.get("status")])
        story.append(styled(data, [22 * mm, 55 * mm, 32 * mm, 18 * mm, 30 * mm, 25 * mm]))
    elif kind == "pnl":
        story.append(styled([["Keterangan", "Nominal"],
                             ["Uang Masuk", rupiah(report["total_income"])],
                             ["Uang Keluar", rupiah(report["total_expense"])],
                             ["Laba Bersih", rupiah(report["net_profit"])]], [110 * mm, 55 * mm]))
    elif kind == "cashflow":
        story.append(styled([["Keterangan", "Nominal"],
                             ["Saldo Awal", rupiah(report["opening_balance"])],
                             ["Uang Masuk", rupiah(report["total_income"])],
                             ["Uang Keluar", rupiah(report["total_expense"])],
                             ["Saldo Akhir", rupiah(report["closing_balance"])]], [110 * mm, 55 * mm]))
    else:
        key = "income_by_category" if kind == "income" else "expense_by_category"
        data = [["Kategori", "Nominal", "Persentase"]]
        for r in report[key]:
            data.append([r["name"], rupiah(r["amount"]), f"{r['percentage']:.1f}%"])
        story.append(styled(data, [80 * mm, 50 * mm, 35 * mm]))
    doc.build(story)
    return buf.getvalue()
