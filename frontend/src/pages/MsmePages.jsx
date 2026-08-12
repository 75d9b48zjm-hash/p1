import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { Loader } from "@/components/Bits";
import { DashboardView } from "@/views/DashboardView";
import { TransactionsView } from "@/views/TransactionsView";
import { ReportsView } from "@/views/ReportsView";
import { InsightsView } from "@/views/InsightsView";

export function MsmeDashboard() {
  const { user, business } = useAuth();
  if (!user?.business_id) return <Layout title="Dashboard"><Loader /></Layout>;
  return (
    <Layout title={`Halo, ${user.name.split(" ")[0]}`} subtitle={business?.name}>
      <DashboardView businessId={user.business_id} />
    </Layout>
  );
}

export function MsmeTransactions() {
  const { user } = useAuth();
  if (!user?.business_id) return <Layout title="Transaksi"><Loader /></Layout>;
  return (
    <Layout title="Catatan Transaksi" subtitle="Semua uang masuk dan keluar usaha Anda">
      <TransactionsView businessId={user.business_id} />
    </Layout>
  );
}

export function MsmeReports() {
  const { user } = useAuth();
  if (!user?.business_id) return <Layout title="Laporan"><Loader /></Layout>;
  return (
    <Layout title="Laporan Keuangan" subtitle="Laba, arus kas, dan ringkasan kategori">
      <ReportsView businessId={user.business_id} />
    </Layout>
  );
}

export function MsmeInsights() {
  const { user } = useAuth();
  if (!user?.business_id) return <Layout title="Analisis"><Loader /></Layout>;
  return (
    <Layout title="Analisis Usaha" subtitle="Bahasa sederhana, tanpa istilah akuntansi">
      <InsightsView businessId={user.business_id} />
    </Layout>
  );
}
