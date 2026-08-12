import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Loader2, ArrowRight } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { rupiah, relativeDays, BUSINESS_STATUS, BUSINESS_TYPES } from "@/lib/format";
import { Layout } from "@/components/Layout";
import { Loader, EmptyState, SectionTitle } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const EMPTY = {
  name: "", owner_name: "", business_type: "Retail", phone: "", email: "", address: "",
  opening_balance: 0, user_email: "", user_password: "",
};

export default function AdminBusinesses() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get("/businesses").then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.name || !form.owner_name || !form.user_email || form.user_password.length < 6)
      return toast.error("Lengkapi nama usaha, pemilik, email login, dan kata sandi (min 6 karakter)");
    setSaving(true);
    try {
      await api.post("/businesses", { ...form, opening_balance: Number(form.opening_balance) || 0 });
      toast.success("UMKM berhasil ditambahkan");
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };

  return (
    <Layout title="Kelola UMKM" subtitle="Daftar seluruh usaha yang Anda dampingi"
      action={<Button data-testid="add-business-button" onClick={() => setOpen(true)}
        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="h-4 w-4 mr-1.5" /> Tambah UMKM</Button>}>
      {rows === null ? <Loader /> : rows.length === 0 ? (
        <div className="card-soft"><EmptyState title="Belum ada UMKM" desc="Tambahkan UMKM pertama untuk mulai membukukan." /></div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 stagger" data-testid="business-list">
          {rows.map((b) => (
            <div key={b.id} className="card-soft p-5 sm:p-6 hover:shadow-md hover:border-emerald-200 transition-all" data-testid={`business-item-${b.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{b.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{b.business_type} · {b.owner_name}</p>
                  <p className="text-xs text-slate-400">{b.email || "-"} · {b.phone || "-"}</p>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${BUSINESS_STATUS[b.status].cls}`}>
                  {BUSINESS_STATUS[b.status].label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-5 text-xs">
                <div><p className="text-slate-400">Masuk</p><p className="font-mono font-semibold text-emerald-600">{rupiah(b.month_income)}</p></div>
                <div><p className="text-slate-400">Keluar</p><p className="font-mono font-semibold text-red-500">{rupiah(b.month_expense)}</p></div>
                <div><p className="text-slate-400">Laba</p><p className="font-mono font-bold text-slate-900">{rupiah(b.month_profit)}</p></div>
              </div>
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">{b.pending_count} perlu tinjauan · {relativeDays(b.last_activity)}</p>
                <Button size="sm" variant="ghost" className="text-emerald-600 rounded-xl" data-testid={`open-business-${b.id}`}
                  onClick={() => navigate(`/admin/umkm/${b.id}`)}>Buka <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg max-h-[92vh] overflow-y-auto" data-testid="business-dialog">
          <DialogHeader><DialogTitle>Tambah UMKM baru</DialogTitle></DialogHeader>
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
            <div className="rounded-xl bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Akun login pemilik usaha</p>
              <div>
                <Label>Email login</Label>
                <Input data-testid="business-user-email" type="email" value={form.user_email} className="mt-1.5 h-11 rounded-xl"
                  onChange={(e) => setForm({ ...form, user_email: e.target.value })} />
              </div>
              <div>
                <Label>Kata sandi awal</Label>
                <Input data-testid="business-user-password" type="password" value={form.user_password} className="mt-1.5 h-11 rounded-xl"
                  placeholder="Minimal 6 karakter" onChange={(e) => setForm({ ...form, user_password: e.target.value })} />
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
    </Layout>
  );
}
