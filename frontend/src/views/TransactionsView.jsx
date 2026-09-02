import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Paperclip, Download, FileText, Filter, X } from "lucide-react";
import api, { apiError, API, downloadFile } from "@/lib/api";
import { rupiah, formatDate, formatDateTime, monthRange } from "@/lib/format";
import { TypeBadge, Amount, Loader, EmptyState } from "@/components/Bits";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ALL = "all";

export const TransactionsView = ({ businessId }) => {
  const [rows, setRows] = useState(null);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    search: "", type: ALL, category: ALL, start_date: "", end_date: "", sort: "newest",
  });
  const [dialog, setDialog] = useState({ open: false, tx: null });
  const [del, setDel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    const params = { ...filters };
    Object.keys(params).forEach((k) => { if (params[k] === ALL || params[k] === "") delete params[k]; });
    if (businessId) params.business_id = businessId;
    const { data } = await api.get("/transactions", { params });
    setRows(data);
  }, [filters, businessId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!businessId) return;
    api.get("/categories", { params: { business_id: businessId } }).then(({ data }) => setCategories(data)).catch(() => {});
  }, [businessId]);

  const doDelete = async () => {
    try {
      await api.delete(`/transactions/${del.id}`);
      toast.success("Transaksi dihapus");
      setDel(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const totals = useMemo(() => {
    const list = rows || [];
    return {
      income: list.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0),
      expense: list.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0),
      count: list.length,
    };
  }, [rows]);

  const openReceipt = (id) => window.open(`${API}/receipts/${id}`, "_blank");

  const exportIt = async (format) => {
    const { start, end } = monthRange();
    try {
      await downloadFile(
        `/export/transactions?format=${format}&business_id=${businessId}&start_date=${filters.start_date || start}&end_date=${filters.end_date || end}`,
        `transaksi.${format === "pdf" ? "pdf" : "csv"}`
      );
      toast.success("Ekspor berhasil diunduh");
    } catch (e) { toast.error(apiError(e)); }
  };

  const clearFilters = () => setFilters({ search: "", type: ALL, category: ALL, start_date: "", end_date: "", sort: "newest" });

  return (
    <div className="space-y-5">
      <div className="card-soft p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input data-testid="search-input" placeholder="Cari deskripsi transaksi..." value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="pl-9 h-11 rounded-xl" />
          </div>
          <Button variant="outline" className="rounded-xl h-11" data-testid="toggle-filters" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1.5" /> Filter
          </Button>
          {businessId && (
            <>
              <Button variant="outline" className="rounded-xl h-11" data-testid="export-csv-transactions" onClick={() => exportIt("csv")}>
                <Download className="h-4 w-4 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" className="rounded-xl h-11" data-testid="export-pdf-transactions" onClick={() => exportIt("pdf")}>
                <FileText className="h-4 w-4 mr-1.5" /> PDF
              </Button>
              <Button data-testid="add-transaction-button" onClick={() => setDialog({ open: true, tx: null })}
                className="rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="h-4 w-4 mr-1.5" /> Catat Transaksi
              </Button>
            </>
          )}
        </div>

        {showFilters && (
          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
            <div>
              <Label className="text-xs">Jenis</Label>
              <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
                <SelectTrigger data-testid="filter-type" className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua</SelectItem>
                  <SelectItem value="income">Uang Masuk</SelectItem>
                  <SelectItem value="expense">Uang Keluar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Kategori</Label>
              <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
                <SelectTrigger data-testid="filter-category" className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Dari tanggal</Label>
              <Input type="date" data-testid="filter-start-date" value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">Sampai tanggal</Label>
              <Input type="date" data-testid="filter-end-date" value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">Urutkan</Label>
              <Select value={filters.sort} onValueChange={(v) => setFilters({ ...filters, sort: v })}>
                <SelectTrigger data-testid="filter-sort" className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Terbaru</SelectItem>
                  <SelectItem value="oldest">Terlama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-3 lg:col-span-5">
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters" className="text-slate-500">
                <X className="h-3.5 w-3.5 mr-1" /> Bersihkan filter
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span className="pt-3">Total <b className="text-slate-700">{totals.count}</b> transaksi</span>
          <span className="pt-3">Masuk <b className="text-emerald-600 font-mono">{rupiah(totals.income)}</b></span>
          <span className="pt-3">Keluar <b className="text-red-500 font-mono">{rupiah(totals.expense)}</b></span>
        </div>
      </div>

      {rows === null ? <Loader /> : rows.length === 0 ? (
        <div className="card-soft"><EmptyState title="Tidak ada transaksi" desc="Coba ubah filter atau catat transaksi baru." /></div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card-soft overflow-hidden">
            <table className="w-full text-sm" data-testid="transactions-table">
              <thead>
                <tr className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-semibold">Tanggal</th>
                  <th className="px-5 py-3 font-semibold">Deskripsi</th>
                  <th className="px-5 py-3 font-semibold">Kategori</th>
                  <th className="px-5 py-3 font-semibold">Jenis</th>
                  <th className="px-5 py-3 font-semibold text-right">Nominal</th>
                  <th className="px-5 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`transaction-row-${t.id}`}>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">{formatDate(t.date)}</td>
                    <td className="px-5 py-3.5">
                      <button className="text-left font-medium text-slate-800 hover:text-emerald-600" data-testid={`detail-${t.id}`} onClick={() => setDetail(t)}>
                        {t.description || "-"}
                      </button>
                      {t.receipt_id && <Paperclip className="inline h-3.5 w-3.5 ml-1.5 text-slate-400" />}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{t.category}</td>
                    <td className="px-5 py-3.5"><TypeBadge type={t.type} /></td>
                    <td className="px-5 py-3.5 text-right"><Amount value={t.amount} type={t.type} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Ubah" data-testid={`edit-${t.id}`}
                          className="h-8 w-8 text-slate-500 hover:bg-slate-100" onClick={() => setDialog({ open: true, tx: t })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Hapus" data-testid={`delete-${t.id}`}
                          className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => setDel(t)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3" data-testid="transactions-cards">
            {rows.map((t) => (
              <div key={t.id} className="card-soft p-4" data-testid={`transaction-card-${t.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 text-left" data-testid={`detail-m-${t.id}`} onClick={() => setDetail(t)}>
                    <p className="font-semibold text-slate-800 truncate">{t.description || t.category}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(t.date)} · {t.category}</p>
                  </button>
                  <Amount value={t.amount} type={t.type} className="text-sm shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-2 mt-3">
                  <TypeBadge type={t.type} />
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="rounded-lg h-8" data-testid={`edit-m-${t.id}`}
                      onClick={() => setDialog({ open: true, tx: t })}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" className="rounded-lg h-8 text-red-500" data-testid={`delete-m-${t.id}`}
                      onClick={() => setDel(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <TransactionDialog open={dialog.open} onOpenChange={(v) => setDialog({ ...dialog, open: v })}
        businessId={businessId || dialog.tx?.business_id} transaction={dialog.tx} onSaved={load} />

      <AlertDialog open={Boolean(del)} onOpenChange={(v) => !v && setDel(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus transaksi ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus transaksi {del?.category} sebesar {rupiah(del?.amount)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" data-testid="cancel-delete">Batal</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-500 hover:bg-red-600" data-testid="confirm-delete" onClick={doDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md" data-testid="transaction-detail">
          <DialogHeader><DialogTitle>Detail Transaksi</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-2.5 text-sm">
              {[
                ["Tanggal", formatDate(detail.date)],
                ["Jenis", detail.type === "income" ? "Uang Masuk" : "Uang Keluar"],
                ["Kategori", detail.category],
                ["Nominal", rupiah(detail.amount)],
                ["Metode", detail.payment_method],
                ["Deskripsi", detail.description || "-"],
                ["Dicatat", formatDateTime(detail.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-medium text-slate-800 text-right">{v}</span>
                </div>
              ))}
              {detail.receipt_id && (
                <Button variant="outline" className="rounded-xl w-full" data-testid="view-receipt" onClick={() => openReceipt(detail.receipt_id)}>
                  <Paperclip className="h-4 w-4 mr-1.5" /> Lihat bukti transaksi
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
