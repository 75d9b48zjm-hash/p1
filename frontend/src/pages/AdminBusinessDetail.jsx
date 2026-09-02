import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import api, { apiError, downloadFile } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { Loader } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DashboardView } from "@/views/DashboardView";
import { TransactionsView } from "@/views/TransactionsView";
import { ReportsView } from "@/views/ReportsView";
import { InsightsView } from "@/views/InsightsView";
import { CategoriesView } from "@/views/CategoriesView";
import BusinessProfileForm from "@/pages/BusinessProfileForm";

export default function ClientWorkspace() {
  const { businessId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState(null);
  const [exporting, setExporting] = useState(false);
  const tab = params.get("tab") || "dashboard";

  useEffect(() => {
    api.get(`/businesses/${businessId}`).then(({ data }) => setBusiness(data)).catch(() => setBusiness(false));
  }, [businessId]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadFile(`/businesses/${businessId}/export`, `Laporan-${business.name}.xlsx`);
      toast.success("File Excel berhasil diunduh");
    } catch (e) { toast.error(apiError(e)); }
    setExporting(false);
  };

  if (business === null) return <Layout title="Memuat..."><Loader /></Layout>;
  if (business === false) return <Layout title="Tidak ditemukan"><p className="text-slate-500">Usaha tidak ditemukan.</p></Layout>;

  return (
    <Layout title={business.name} subtitle={`${business.business_type} · ${business.owner_name}`}
      action={
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" data-testid="export-excel-button" onClick={exportExcel} disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" /> {exporting ? "Menyiapkan..." : "Export Excel"}
          </Button>
          <Button variant="ghost" className="rounded-xl" data-testid="back-to-businesses" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Klien
          </Button>
        </div>
      }>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="rounded-xl bg-slate-100 p-1 flex-wrap h-auto mb-6">
          <TabsTrigger value="dashboard" data-testid="btab-dashboard" className="rounded-lg">Dashboard</TabsTrigger>
          <TabsTrigger value="transaksi" data-testid="btab-transaksi" className="rounded-lg">Transaksi</TabsTrigger>
          <TabsTrigger value="laporan" data-testid="btab-laporan" className="rounded-lg">Laporan</TabsTrigger>
          <TabsTrigger value="insight" data-testid="btab-insight" className="rounded-lg">Analisis</TabsTrigger>
          <TabsTrigger value="kategori" data-testid="btab-kategori" className="rounded-lg">Kategori</TabsTrigger>
          <TabsTrigger value="profil" data-testid="btab-profil" className="rounded-lg">Profil</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><DashboardView businessId={businessId} onExport={exportExcel} exporting={exporting} /></TabsContent>
        <TabsContent value="transaksi"><TransactionsView businessId={businessId} /></TabsContent>
        <TabsContent value="laporan"><ReportsView businessId={businessId} /></TabsContent>
        <TabsContent value="insight"><InsightsView businessId={businessId} /></TabsContent>
        <TabsContent value="kategori"><CategoriesView businessId={businessId} /></TabsContent>
        <TabsContent value="profil"><BusinessProfileForm businessId={businessId} isAdmin /></TabsContent>
      </Tabs>
    </Layout>
  );
}
