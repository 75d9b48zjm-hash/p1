import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Receipt, FileText, FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import api from "@/lib/api";
import { rupiah, rupiahShort, formatDate } from "@/lib/format";
import { MetricCard, Amount, Loader, EmptyState } from "@/components/Bits";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";

const PIE_COLORS = ["#EF4444", "#F59E0B", "#059669", "#0EA5E9", "#8B5CF6", "#EC4899", "#14B8A6"];

const chartTooltip = {
  contentStyle: { borderRadius: 12, border: "none", background: "#0F172A", color: "#fff", fontSize: 12 },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#94A3B8" },
  formatter: (v) => rupiah(v),
};

const periodLabel = () =>
  new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

export const DashboardView = ({ businessId, onExport, exporting = false, onExportPdf, exportingPdf = false }) => {
  const [data, setData] = useState(null);
  const [dialog, setDialog] = useState({ open: false, type: "income" });
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get("/dashboard/business", { params: businessId ? { business_id: businessId } : {} })
      .then(({ data }) => setData(data))
      .catch(() => setData(null));
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <Loader />;

  const bid = data.business.id;
  const expensePie = data.expense_categories.slice(0, 6).map((c) => ({ name: c.name, value: c.amount }));

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="dashboard-view">
      {/* Header rapi untuk di-screenshot */}
      <div className="rounded-2xl bg-slate-900 text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4" data-testid="dashboard-header">
        <div>
          <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide">KasUMKM · Laporan Bulanan</p>
          <p className="text-xl sm:text-2xl font-bold mt-0.5">{data.business.name}</p>
          <p className="text-sm text-slate-300 mt-0.5">Periode {periodLabel()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Saldo Saat Ini</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">{rupiah(data.balance)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 stagger">
        <MetricCard testId="metric-balance" label="Saldo Saat Ini" value={rupiah(data.balance)} Icon={Wallet} tone="green"
          sub="Saldo awal + masuk - keluar" />
        <MetricCard testId="metric-income" label="Uang Masuk (bulan ini)" value={rupiah(data.month_income)} Icon={TrendingUp} tone="green" />
        <MetricCard testId="metric-expense" label="Uang Keluar (bulan ini)" value={rupiah(data.month_expense)} Icon={TrendingDown} tone="red" />
        <MetricCard testId="metric-profit" label="Laba Bersih (bulan ini)" value={rupiah(data.month_profit)} Icon={PiggyBank}
          tone={data.month_profit >= 0 ? "green" : "red"} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Button data-testid="quick-add-income" onClick={() => setDialog({ open: true, type: "income" })}
          className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all">
          <Plus className="h-4 w-4 mr-1.5" /> Uang Masuk
        </Button>
        <Button data-testid="quick-add-expense" onClick={() => setDialog({ open: true, type: "expense" })}
          className="h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all">
          <Plus className="h-4 w-4 mr-1.5" /> Uang Keluar
        </Button>
        <Button variant="outline" data-testid="quick-view-transactions"
          onClick={() => navigate(`/umkm/${bid}?tab=transaksi`)}
          className="h-14 rounded-2xl bg-white text-sm font-semibold">
          <Receipt className="h-4 w-4 mr-1.5" /> Catatan Transaksi
        </Button>
        {onExportPdf ? (
          <Button data-testid="quick-export-pdf" onClick={onExportPdf} disabled={exportingPdf}
            className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all">
            <FileText className="h-4 w-4 mr-1.5" /> {exportingPdf ? "Menyiapkan..." : "Laporan PDF"}
          </Button>
        ) : onExport ? (
          <Button variant="outline" data-testid="quick-export-excel" onClick={onExport} disabled={exporting}
            className="h-14 rounded-2xl bg-white text-sm font-semibold">
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" /> {exporting ? "Menyiapkan..." : "Export Excel"}
          </Button>
        ) : (
          <Button variant="outline" data-testid="quick-view-reports"
            onClick={() => navigate(`/umkm/${bid}?tab=laporan`)}
            className="h-14 rounded-2xl bg-white text-sm font-semibold">
            <FileText className="h-4 w-4 mr-1.5" /> Laporan
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-soft p-5 sm:p-6" data-testid="chart-income-expense">
          <p className="font-semibold text-slate-800">Uang Masuk vs Uang Keluar</p>
          <p className="text-xs text-slate-500 mb-4">6 bulan terakhir</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthly} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={rupiahShort} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={62} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="income" name="Uang Masuk" fill="#10B981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Uang Keluar" fill="#EF4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-soft p-5 sm:p-6" data-testid="chart-profit-trend">
          <p className="font-semibold text-slate-800">Tren Laba Bulanan</p>
          <p className="text-xs text-slate-500 mb-4">Perkembangan keuntungan usaha</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={rupiahShort} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={62} />
              <Tooltip {...chartTooltip} />
              <Line type="monotone" dataKey="profit" name="Laba" stroke="#059669" strokeWidth={3} dot={{ r: 4, fill: "#059669" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="card-soft p-5 sm:p-6 lg:col-span-2" data-testid="chart-expense-pie">
          <p className="font-semibold text-slate-800">Sebaran Pengeluaran</p>
          <p className="text-xs text-slate-500 mb-2">Bulan ini</p>
          {expensePie.length === 0 ? (
            <EmptyState title="Belum ada pengeluaran" desc="Catat pengeluaran untuk melihat sebarannya." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={expensePie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {expensePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card-soft lg:col-span-3 overflow-hidden">
          <div className="p-5 sm:p-6 pb-3">
            <p className="font-semibold text-slate-800">Transaksi Terbaru</p>
            <p className="text-xs text-slate-500">8 catatan terakhir</p>
          </div>
          <div className="divide-y divide-slate-100" data-testid="recent-transactions">
            {data.recent.length === 0 && <EmptyState title="Belum ada transaksi" desc="Mulai catat uang masuk atau keluar." />}
            {data.recent.map((t) => (
              <div key={t.id} className="px-5 sm:px-6 py-3.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{t.description || t.category}</p>
                  <p className="text-xs text-slate-500">{formatDate(t.date)} · {t.category} · {t.payment_method}</p>
                </div>
                <Amount value={t.amount} type={t.type} className="text-sm shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <TransactionDialog open={dialog.open} onOpenChange={(v) => setDialog({ ...dialog, open: v })}
        businessId={bid} defaultType={dialog.type} onSaved={load} />
    </div>
  );
};
