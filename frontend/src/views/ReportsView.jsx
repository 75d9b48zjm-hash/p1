import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";
import api, { apiError, downloadFile } from "@/lib/api";
import { rupiah, formatDate, monthRange } from "@/lib/format";
import { Loader, SectionTitle } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const PRESETS = [
  { key: "today", label: "Harian" },
  { key: "week", label: "Mingguan" },
  { key: "month", label: "Bulanan" },
  { key: "custom", label: "Pilih Tanggal" },
];

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presetRange(key) {
  const now = new Date();
  if (key === "today") return { start: fmt(now), end: fmt(now) };
  if (key === "week") {
    const s = new Date(now);
    s.setDate(now.getDate() - 6);
    return { start: fmt(s), end: fmt(now) };
  }
  return monthRange();
}

const Row = ({ label, value, bold, tone }) => (
  <div className={`flex items-center justify-between py-3 border-b border-slate-100 last:border-0 ${bold ? "font-bold" : ""}`}>
    <span className={bold ? "text-slate-900" : "text-slate-600"}>{label}</span>
    <span className={`font-mono tabular-nums ${tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-500" : "text-slate-900"} ${bold ? "text-lg" : ""}`}>
      {value}
    </span>
  </div>
);

const CategoryTable = ({ items, tone, testId }) => (
  <div data-testid={testId}>
    {items.length === 0 && <p className="text-sm text-slate-500 py-4">Belum ada data pada periode ini.</p>}
    {items.map((c) => (
      <div key={c.name} className="py-3 border-b border-slate-100 last:border-0">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-700 font-medium">{c.name}</span>
          <span className={`font-mono font-semibold ${tone === "green" ? "text-emerald-600" : "text-red-500"}`}>{rupiah(c.amount)}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${tone === "green" ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${c.percentage}%` }} />
        </div>
        <p className="text-xs text-slate-400 mt-1">{c.percentage.toFixed(1)}% dari total</p>
      </div>
    ))}
  </div>
);

export const ReportsView = ({ businessId }) => {
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState(monthRange());
  const [report, setReport] = useState(null);

  const load = useCallback(() => {
    if (!businessId) return;
    api.get("/reports", { params: { business_id: businessId, start_date: range.start, end_date: range.end } })
      .then(({ data }) => setReport(data)).catch(() => setReport(null));
  }, [businessId, range]);

  useEffect(() => { load(); }, [load]);

  const choose = (key) => {
    setPreset(key);
    if (key !== "custom") setRange(presetRange(key));
  };

  const exportIt = async (kind, format) => {
    try {
      await downloadFile(
        `/export/${kind}?format=${format}&business_id=${businessId}&start_date=${range.start}&end_date=${range.end}`,
        `${kind}.${format === "pdf" ? "pdf" : "csv"}`
      );
      toast.success("Laporan berhasil diunduh");
    } catch (e) { toast.error(apiError(e)); }
  };

  if (!report) return <Loader />;

  const ExportButtons = ({ kind }) => (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="rounded-xl" data-testid={`export-csv-${kind}`} onClick={() => exportIt(kind, "csv")}>
        <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
      </Button>
      <Button variant="outline" size="sm" className="rounded-xl" data-testid={`export-pdf-${kind}`} onClick={() => exportIt(kind, "pdf")}>
        <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="card-soft p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.key} data-testid={`preset-${p.key}`} onClick={() => choose(p.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                preset === p.key ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="grid sm:grid-cols-2 gap-3 mt-4 max-w-md">
            <div>
              <Label className="text-xs">Dari</Label>
              <Input type="date" data-testid="report-start-date" value={range.start} className="mt-1 h-10 rounded-xl"
                onChange={(e) => setRange({ ...range, start: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Sampai</Label>
              <Input type="date" data-testid="report-end-date" value={range.end} className="mt-1 h-10 rounded-xl"
                onChange={(e) => setRange({ ...range, end: e.target.value })} />
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Periode: <b>{formatDate(range.start)} – {formatDate(range.end)}</b>
        </p>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList className="rounded-xl bg-slate-100 p-1 flex-wrap h-auto">
          <TabsTrigger value="pnl" data-testid="tab-pnl" className="rounded-lg">Laba / Rugi</TabsTrigger>
          <TabsTrigger value="cashflow" data-testid="tab-cashflow" className="rounded-lg">Arus Kas</TabsTrigger>
          <TabsTrigger value="income" data-testid="tab-income" className="rounded-lg">Uang Masuk</TabsTrigger>
          <TabsTrigger value="expense" data-testid="tab-expense" className="rounded-lg">Uang Keluar</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="mt-5">
          <div className="card-soft p-5 sm:p-6" data-testid="report-pnl">
            <SectionTitle title="Laba / Rugi" desc={report.business_name} right={<ExportButtons kind="pnl" />} />
            <Row label="Uang Masuk" value={rupiah(report.total_income)} tone="green" />
            <Row label="Uang Keluar" value={rupiah(report.total_expense)} tone="red" />
            <Row label="Laba Bersih" value={rupiah(report.net_profit)} bold tone={report.net_profit >= 0 ? "green" : "red"} />
            <p className="text-xs text-slate-500 mt-3">Margin keuntungan: <b>{report.profit_margin.toFixed(1)}%</b> · {report.transaction_count} transaksi</p>
          </div>
        </TabsContent>

        <TabsContent value="cashflow" className="mt-5">
          <div className="card-soft p-5 sm:p-6" data-testid="report-cashflow">
            <SectionTitle title="Arus Kas" desc={report.business_name} right={<ExportButtons kind="cashflow" />} />
            <Row label="Saldo Awal" value={rupiah(report.opening_balance)} />
            <Row label="Uang Masuk" value={rupiah(report.total_income)} tone="green" />
            <Row label="Uang Keluar" value={rupiah(report.total_expense)} tone="red" />
            <Row label="Saldo Akhir" value={rupiah(report.closing_balance)} bold />
          </div>
        </TabsContent>

        <TabsContent value="income" className="mt-5">
          <div className="card-soft p-5 sm:p-6">
            <SectionTitle title="Ringkasan Uang Masuk" desc="Berdasarkan kategori" right={<ExportButtons kind="income" />} />
            <CategoryTable items={report.income_by_category} tone="green" testId="income-summary" />
          </div>
        </TabsContent>

        <TabsContent value="expense" className="mt-5">
          <div className="card-soft p-5 sm:p-6">
            <SectionTitle title="Ringkasan Uang Keluar" desc="Berdasarkan kategori" right={<ExportButtons kind="expense" />} />
            <CategoryTable items={report.expense_by_category} tone="red" testId="expense-summary" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
