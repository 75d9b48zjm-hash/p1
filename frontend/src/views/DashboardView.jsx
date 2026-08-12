import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Receipt, FileBarChart2, Clock,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import api from "@/lib/api";
import { rupiah, rupiahShort, formatDate } from "@/lib/format";
import { MetricCard, StatusBadge, Amount, Loader, EmptyState, SectionTitle } from "@/components/Bits";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";

const PIE_COLORS = ["#EF4444", "#F59E0B", "#059669", "#0EA5E9", "#8B5CF6", "#EC4899", "#14B8A6"];

const chartTooltip = {
  contentStyle: { borderRadius: 12, border: "none", background: "#0F172A", color: "#fff", fontSize: 12 },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#94A3B8" },
  formatter: (v) => rupiah(v),
};

export const DashboardView = ({ businessId, canAdd = true, adminMode = false }) => {
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
    <div className="space-y-6 sm:space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 stagger">
        <MetricCard testId="metric-balance" label="Saldo Saat Ini" value={rupiah(data.balance)} Icon={Wallet} tone="green"
          sub="Saldo awal + masuk - keluar" />
        <MetricCard testId="metric-income" label="Uang Masuk (bulan ini)" value={rupiah(data.month_income)} Icon={TrendingUp} tone="green" />
        <MetricCard testId="metric-expense" label="Uang Keluar (bulan ini)" value={rupiah(data.month_expense)} Icon={TrendingDown} tone="red" />
        <MetricCard testId="metric-profit" label="Laba Bersih (bulan ini)" value={rupiah(data.month_profit)} Icon={PiggyBank}
          tone={data.month_profit >= 0 ? "green" : "red"} />
      </div>

      {(data.pending_count > 0 || data.needs_correction_count > 0) && (
        <div data-testid="pending-banner" className="card-soft p-4 sm:p-5 flex flex-wrap items-center gap-3 border-amber-200/70 bg-amber-50/50">
          <Clock className="h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800 flex-1">
            <b>{data.pending_count}</b> transaksi menunggu tinjauan
            {data.needs_correction_count > 0 && <> dan <b>{data.needs_correction_count}</b> perlu perbaikan</>}. Transaksi ini belum masuk laporan resmi.
          </p>
          <Button variant="outline" size="sm" className="rounded-xl" data-testid="review-shortcut"
            onClick={() => navigate(adminMode ? "/admin/transaksi" : "/transaksi")}>Lihat</Button>
        </div>
      )}

      {canAdd && (
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
            onClick={() => navigate(adminMode ? `/admin/umkm/${bid}?tab=transaksi` : "/transaksi")}
            className="h-14 rounded-2xl bg-white text-sm font-semibold">
            <Receipt className="h-4 w-4 mr-1.5" /> Catatan Transaksi
          </Button>
          <Button variant="outline" data-testid="quick-view-reports"
            onClick={() => navigate(adminMode ? `/admin/umkm/${bid}?tab=laporan` : "/laporan")}
            className="h-14 rounded-2xl bg-white text-sm font-semibold">
            <FileBarChart2 className="h-4 w-4 mr-1.5" /> Laporan
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-soft p-5 sm:p-6" data-testid="chart-income-expense">
          <p className="font-semibold text-slate-800">Uang Masuk vs Uang Keluar</p>
          <p className="text-xs text-slate-500 mb-4">6 bulan terakhir (transaksi disetujui)</p>
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
            {data.recent.length === 0 && <EmptyState title="Belum ada transaksi" desc="Mulai catat uang masuk atau keluar Anda." />}
            {data.recent.map((t) => (
              <div key={t.id} className="px-5 sm:px-6 py-3.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{t.description || t.category}</p>
                  <p className="text-xs text-slate-500">{formatDate(t.date)} · {t.category} · {t.payment_method}</p>
                </div>
                <div className="text-right shrink-0">
                  <Amount value={t.amount} type={t.type} className="text-sm" />
                  <div className="mt-1"><StatusBadge status={t.status} /></div>
                </div>
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
