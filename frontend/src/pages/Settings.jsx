import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import BusinessProfileForm from "@/pages/BusinessProfileForm";
import { CategoriesView } from "@/views/CategoriesView";

const AccountSettings = () => {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [prefs, setPrefs] = useState({ notify_email: user?.notify_email ?? true, notify_app: user?.notify_app ?? true });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [saving, setSaving] = useState(false);

  const saveProfile = async (extra = {}) => {
    setSaving(true);
    try {
      await api.put("/profile", { ...form, ...prefs, ...extra });
      toast.success("Pengaturan disimpan");
      refresh();
    } catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (pw.new_password.length < 6) return toast.error("Kata sandi baru minimal 6 karakter");
    try {
      await api.post("/auth/change-password", pw);
      toast.success("Kata sandi berhasil diubah");
      setPw({ current_password: "", new_password: "" });
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card-soft p-5 sm:p-6" data-testid="account-settings">
        <p className="font-semibold text-slate-800 mb-4">Akun Saya</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Nama</Label>
            <Input data-testid="account-name" value={form.name} className="mt-1.5 h-11 rounded-xl"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Nomor HP</Label>
            <Input data-testid="account-phone" value={form.phone} className="mt-1.5 h-11 rounded-xl"
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="mt-1.5 h-11 rounded-xl bg-slate-50" />
          </div>
        </div>
        <Button data-testid="save-account-button" onClick={() => saveProfile()} disabled={saving}
          className="mt-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
        </Button>
      </div>

      <div className="card-soft p-5 sm:p-6" data-testid="notification-settings">
        <p className="font-semibold text-slate-800 mb-4">Notifikasi</p>
        {[
          ["notify_app", "Notifikasi dalam aplikasi"],
          ["notify_email", "Notifikasi lewat email"],
        ].map(([k, label]) => (
          <div key={k} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-700">{label}</span>
            <Switch data-testid={`switch-${k}`} checked={prefs[k]}
              onCheckedChange={(v) => { setPrefs({ ...prefs, [k]: v }); saveProfile({ [k]: v }); }} />
          </div>
        ))}
      </div>

      <div className="card-soft p-5 sm:p-6" data-testid="password-settings">
        <p className="font-semibold text-slate-800 mb-4">Ubah Kata Sandi</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Kata sandi lama</Label>
            <Input data-testid="current-password" type="password" value={pw.current_password} className="mt-1.5 h-11 rounded-xl"
              onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          </div>
          <div>
            <Label>Kata sandi baru</Label>
            <Input data-testid="new-password" type="password" value={pw.new_password} className="mt-1.5 h-11 rounded-xl"
              onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          </div>
        </div>
        <Button data-testid="change-password-button" onClick={changePassword} variant="outline" className="mt-5 rounded-xl">
          Ubah kata sandi
        </Button>
      </div>
    </div>
  );
};

export default function Settings() {
  const { user, business } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <Layout title="Pengaturan" subtitle={isAdmin ? "Pengaturan admin dan sistem" : business?.name}>
      <Tabs defaultValue={isAdmin ? "akun" : "usaha"}>
        <TabsList className="rounded-xl bg-slate-100 p-1 flex-wrap h-auto mb-6">
          {!isAdmin && <TabsTrigger value="usaha" data-testid="stab-usaha" className="rounded-lg">Profil Usaha</TabsTrigger>}
          <TabsTrigger value="akun" data-testid="stab-akun" className="rounded-lg">Akun & Notifikasi</TabsTrigger>
          {!isAdmin && <TabsTrigger value="kategori" data-testid="stab-kategori" className="rounded-lg">Kategori</TabsTrigger>}
        </TabsList>
        {!isAdmin && (
          <TabsContent value="usaha"><BusinessProfileForm businessId={user?.business_id} /></TabsContent>
        )}
        <TabsContent value="akun"><AccountSettings /></TabsContent>
        {!isAdmin && (
          <TabsContent value="kategori"><CategoriesView businessId={user?.business_id} /></TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="akun-extra" />
        )}
      </Tabs>
      {isAdmin && (
        <div className="card-soft p-5 sm:p-6 mt-6 max-w-2xl">
          <p className="font-semibold text-slate-800">Sistem</p>
          <p className="text-sm text-slate-500 mt-2">
            Kelola UMKM di menu <b>UMKM</b>, kategori tiap usaha di menu <b>Kategori</b>, dan jejak perubahan di <b>Log Audit</b>.
          </p>
        </div>
      )}
    </Layout>
  );
}
