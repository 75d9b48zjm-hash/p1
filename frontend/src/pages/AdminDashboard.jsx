import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, TrendingUp, TrendingDown, PiggyBank, ClipboardCheck, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { rupiah, relativeDays, BUSINESS_STATUS } from "@/lib/format";
import { Layout } from "@/components/Layout";
import { MetricCard, Loader, SectionTitle, EmptyState } from "@/components/Bits";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/admin").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/businesses").then(({ data }) => setBusinesses(data)).catch(() => setBusinesses([]));
  }, []);

  return (
    <Layout title="Dashboard Pembukuan" subtitle="Ringkasan seluruh UMKM yang Anda kelola">
      {!stats ? <Loader /> : (
        <div className="space-y-7">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 stagger">
            <MetricCard testId="admin-metric-businesses" label="Total UMKM" value={stats.total_businesses} Icon={Store} />
            <MetricCard testId="admin-metric-income" label="Uang Masuk" value={rupiah(stats.total_income)} Icon={TrendingUp} tone="green" sub="Bulan ini" />
            <MetricCard testId="admin-metric-expense" label="Uang Keluar" value={rupiah(stats.total_expense)} Icon={TrendingDown} tone="red" sub="Bulan ini" />
            <MetricCard testId="admin-metric-profit" label="Laba Bersih" value={rupiah(stats.net_profit)} Icon={PiggyBank}
              tone={stats.net_profit >= 0 ? "green" : "red"} sub="Bulan ini" />
            <MetricCard testId="admin-metric-pending" label="Perlu Tinjauan" value={stats.pending_count} Icon={ClipboardCheck} tone="amber"
              sub={`${stats.needs_correction_count} perlu perbaikan`} />
          </div>

          {stats.pending_count > 0 && (
            <div className="card-soft p-5 flex flex-wrap items-center gap-3 bg-amber-50/50 border-amber-200/70">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-800 flex-1">
                Ada <b>{stats.pending_count}</b> transaksi menunggu tinjauan Anda. Transaksi ini belum masuk laporan resmi UMKM.
              </p>
              <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="goto-cockpit"
                onClick={() => navigate("/admin/kategorisasi")}>Buka Cockpit</Button>
              <Button variant="outline" className="rounded-xl" data-testid="goto-review"
                onClick={() => navigate("/admin/transaksi")}>Tinjau manual</Button>
            </div>
          )}

          <div>
            <SectionTitle title="UMKM yang dikelola" desc="Klik salah satu untuk membuka pembukuan detail"
              right={<Button variant="outline" className="rounded-xl" data-testid="goto-businesses" onClick={() => navigate("/admin/umkm")}>
                Kelola UMKM <ArrowRight className="h-4 w-4 ml-1.5" /></Button>} />
            {businesses === null ? <Loader /> : businesses.length === 0 ? (
              <div className="card-soft"><EmptyState title="Belum ada UMKM" desc="Tambahkan UMKM pertama Anda." /></div>
            ) : (
              <>
                <div className="hidden lg:block card-soft overflow-hidden">
                  <table className="w-full text-sm" data-testid="admin-business-table">
                    <thead>
                      <tr className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Usaha</th>
                        <th className="px-5 py-3 font-semibold">Jenis</th>
                        <th className="px-5 py-3 font-semibold">Pemilik</th>
                        <th className="px-5 py-3 font-semibold text-right">Masuk</th>
                        <th className="px-5 py-3 font-semibold text-right">Keluar</th>
                        <th className="px-5 py-3 font-semibold text-right">Laba</th>
                        <th className="px-5 py-3 font-semibold text-center">Perlu Tinjauan</th>
                        <th className="px-5 py-3 font-semibold">Aktivitas</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {businesses.map((b) => (
                        <tr key={b.id} data-testid={`business-row-${b.id}`} onClick={() => navigate(`/admin/umkm/${b.id}`)}
                          className="hover:bg-emerald-50/40 cursor-pointer transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-slate-800">{b.name}</td>
                          <td className="px-5 py-3.5 text-slate-600">{b.business_type}</td>
                          <td className="px-5 py-3.5 text-slate-600">{b.owner_name}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-emerald-600">{rupiah(b.month_income)}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-red-500">{rupiah(b.month_expense)}</td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">{rupiah(b.month_profit)}</td>
                          <td className="px-5 py-3.5 text-center">
                            {b.pending_count > 0 ? (
                              <span className="inline-grid place-items-center h-6 min-w-6 px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{b.pending_count}</span>
                            ) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs">{relativeDays(b.last_activity)}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${BUSINESS_STATUS[b.status].cls}`}>
                              {BUSINESS_STATUS[b.status].label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden grid sm:grid-cols-2 gap-4">
                  {businesses.map((b) => (
                    <button key={b.id} data-testid={`business-card-${b.id}`} onClick={() => navigate(`/admin/umkm/${b.id}`)}
                      className="card-soft p-5 text-left hover:border-emerald-300 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900">{b.name}</p>
                          <p className="text-xs text-slate-500">{b.business_type} · {b.owner_name}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${BUSINESS_STATUS[b.status].cls}`}>
                          {BUSINESS_STATUS[b.status].label}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                        <div><p className="text-slate-400">Masuk</p><p className="font-mono font-semibold text-emerald-600">{rupiah(b.month_income)}</p></div>
                        <div><p className="text-slate-400">Keluar</p><p className="font-mono font-semibold text-red-500">{rupiah(b.month_expense)}</p></div>
                        <div><p className="text-slate-400">Laba</p><p className="font-mono font-bold text-slate-900">{rupiah(b.month_profit)}</p></div>
                      </div>
                      <p className="text-xs text-slate-400 mt-3">{b.pending_count} perlu tinjauan · {relativeDays(b.last_activity)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
