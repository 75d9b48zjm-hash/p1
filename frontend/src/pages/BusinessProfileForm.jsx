import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { BUSINESS_TYPES } from "@/lib/format";
import { Loader } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function BusinessProfileForm({ businessId, isAdmin = false }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    api.get(`/businesses/${businessId}`).then(({ data }) => setForm(data)).catch(() => setForm(false));
  }, [businessId]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/businesses/${businessId}`, {
        name: form.name, owner_name: form.owner_name, business_type: form.business_type,
        phone: form.phone || "", email: form.email || "", address: form.address || "",
        opening_balance: Number(form.opening_balance) || 0, logo_url: form.logo_url || null,
      });
      toast.success("Profil usaha diperbarui");
    } catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };

  if (form === null) return <Loader />;
  if (form === false) return <p className="text-slate-500">Profil usaha tidak ditemukan.</p>;

  return (
    <div className="card-soft p-5 sm:p-6 max-w-2xl" data-testid="business-profile-form">
      <p className="font-semibold text-slate-800 mb-5">Profil Usaha</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          ["name", "Nama usaha"],
          ["owner_name", "Nama pemilik"],
          ["phone", "Nomor HP"],
          ["email", "Email usaha"],
        ].map(([k, label]) => (
          <div key={k}>
            <Label>{label}</Label>
            <Input data-testid={`profile-${k}`} value={form[k] || ""} className="mt-1.5 h-11 rounded-xl"
              onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
        <div>
          <Label>Jenis usaha</Label>
          <Select value={form.business_type} onValueChange={(v) => setForm({ ...form, business_type: v })}>
            <SelectTrigger data-testid="profile-business-type" className="mt-1.5 h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <div>
            <Label>Saldo awal (Rp)</Label>
            <Input data-testid="profile-opening-balance" type="number" value={form.opening_balance || 0} className="mt-1.5 h-11 rounded-xl"
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label>Alamat</Label>
          <Input data-testid="profile-address" value={form.address || ""} className="mt-1.5 h-11 rounded-xl"
            onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </div>
      <Button data-testid="save-profile-button" onClick={save} disabled={saving}
        className="mt-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan perubahan
      </Button>
    </div>
  );
}
