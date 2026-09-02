import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Loader2, ArrowRight, Trash2, Store } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { rupiah, relativeDays, BUSINESS_TYPES } from "@/lib/format";
import { Layout } from "@/components/Layout";
import { Loader, EmptyState } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EMPTY = { name: "", owner_name: "", business_type: "Retail", phone: "", address: "", opening_balance: 0 };

export default function ClientsHome() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get("/businesses").then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.name || !form.owner_name) return toast.error("Lengkapi nama usaha dan nama pemilik");
    setSaving(true);
    try {
      await api.post("/businesses", { ...form, opening_balance: Number(form.opening_balance) || 0 });
      toast.success("Klien UMKM berhasil ditambahkan");
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };

  const doDelete = async () => {
    try {
      await api.delete(`/businesses/${del.id}`);
      toast.success("Klien UMKM dihapus");
      setDel(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <Layout title="Klien UMKM" subtitle="Daftar usaha yang Anda bukukan — pilih satu untuk mulai mencatat"
      action={<Button data-testid="add-business-button" onClick={() => setOpen(true)}
        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="h-4 w-4 mr-1.5" /> Tambah UMKM</Button>}>
      {rows === null ? <Loader /> : rows.length === 0 ? (
        <div className="card-soft"><EmptyState title="Belum ada klien UMKM" desc="Tambahkan UMKM pertama untuk mulai membukukan.">
          <Button data-testid="empty-add-business" onClick={() => setOpen(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Tambah UMKM
          </Button>
        </EmptyState></div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 stagger" data-testid="business-list">
          {rows.map((b) => (
            <div key={b.id} className="card-soft p-5 sm:p-6 hover:shadow-md hover:border-emerald-200 transition-all" data-testid={`business-item-${b.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 grid place-items-center">
                    <Store className="h-5 w-5 text-emerald-600" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{b.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{b.business_type} · {b.owner_name}</p>
                    <p className="text-xs text-slate-400 truncate">{b.phone || "-"}</p>
                  </div>
                </div>
                <button data-testid={`delete-business-${b.id}`} onClick={() => setDel(b)}
                  className="shrink-0 text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-5 text-xs">
                <div><p className="text-slate-400">Masuk</p><p className="font-mono font-semibold text-emerald-600">{rupiah(b.month_income)}</p></div>
                <div><p className="text-slate-400">Keluar</p><p className="font-mono font-semibold text-red-500">{rupiah(b.month_expense)}</p></div>
                <div><p className="text-slate-400">Laba</p><p className="font-mono font-bold text-slate-900">{rupiah(b.month_profit)}</p></div>
              </div>
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">Update: {relativeDays(b.last_activity)}</p>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" data-testid={`open-business-${b.id}`}
                  onClick={() => navigate(`/umkm/${b.id}`)}>Buka <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg max-h-[92vh] overflow-y-auto" data-testid="business-dialog">
          <DialogHeader>
            <DialogTitle>Tambah klien UMKM</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Cukup nama usaha & pemilik. Kolom lain opsional. Tanpa akun/kata sandi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {[
              ["name", "Nama usaha", "Toko Berkah"],
              ["owner_name", "Nama pemilik", "Budi"],
              ["phone", "Nomor HP", "08xxxxxxxxxx"],
              ["address", "Alamat", "Jl. ..."],
            ].map(([k, label, ph]) => (
              <div key={k}>
                <Label>{label}</Label>
                <Input data-testid={`business-${k}`} value={form[k]} placeholder={ph} className="mt-1.5 h-11 rounded-xl"
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Jenis usaha</Label>
                <Select value={form.business_type} onValueChange={(v) => setForm({ ...form, business_type: v })}>
                  <SelectTrigger data-testid="business-type" className="mt-1.5 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Saldo awal (Rp)</Label>
                <Input data-testid="business-opening-balance" type="number" value={form.opening_balance} className="mt-1.5 h-11 rounded-xl"
                  onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Batal</Button>
            <Button data-testid="submit-business-button" onClick={submit} disabled={saving}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(del)} onOpenChange={(v) => !v && setDel(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus klien "{del?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua transaksi UMKM ini akan ikut terhapus dari daftar. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" data-testid="cancel-delete-business">Batal</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-500 hover:bg-red-600" data-testid="confirm-delete-business" onClick={doDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
