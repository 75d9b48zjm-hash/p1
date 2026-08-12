import { useState } from "react";
import { Layout } from "@/components/Layout";
import { BusinessPicker } from "@/components/BusinessPicker";
import { TransactionsView } from "@/views/TransactionsView";
import { ReportsView } from "@/views/ReportsView";
import { InsightsView } from "@/views/InsightsView";
import { CategoriesView } from "@/views/CategoriesView";

export function AdminTransactions() {
  return (
    <Layout title="Semua Transaksi" subtitle="Tinjau, setujui, atau perbaiki transaksi dari seluruh UMKM">
      <TransactionsView isAdmin showBusinessColumn defaultStatus="pending" />
    </Layout>
  );
}

export function AdminReports() {
  const [bid, setBid] = useState(null);
  return (
    <Layout title="Laporan Keuangan" subtitle="Pilih UMKM untuk melihat laporannya">
      <div className="space-y-6">
        <BusinessPicker value={bid} onChange={setBid} />
        {bid && <ReportsView businessId={bid} />}
      </div>
    </Layout>
  );
}

export function AdminInsights() {
  const [bid, setBid] = useState(null);
  return (
    <Layout title="Analisis Usaha" subtitle="Ringkasan otomatis kondisi usaha">
      <div className="space-y-6">
        <BusinessPicker value={bid} onChange={setBid} />
        {bid && <InsightsView businessId={bid} />}
      </div>
    </Layout>
  );
}

export function AdminCategories() {
  const [bid, setBid] = useState(null);
  return (
    <Layout title="Kategori" subtitle="Kelola kategori uang masuk dan keluar per UMKM">
      <div className="space-y-6">
        <BusinessPicker value={bid} onChange={setBid} />
        {bid && <CategoriesView businessId={bid} />}
      </div>
    </Layout>
  );
}
