import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/pages/Login";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { BUSINESS_TYPES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "", business_name: "", business_type: "Retail", phone: "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Kata sandi minimal 6 karakter");
    setLoading(true);
    try {
      await register(form);
      toast.success("Akun berhasil dibuat!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(apiError(err));
    }
    setLoading(false);
  };

  return (
    <AuthShell
      title="Daftar usaha Anda"
      subtitle="Gratis, cukup 1 menit. Langsung bisa mencatat transaksi."
      footer={<>Sudah punya akun? <Link to="/login" className="font-semibold text-emerald-600 hover:underline" data-testid="link-login">Masuk</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="bn">Nama usaha</Label>
          <Input id="bn" data-testid="register-business-name" required value={form.business_name} className="mt-1.5 h-12 rounded-xl"
            placeholder="Contoh: Toko Berkah" onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="on">Nama pemilik</Label>
            <Input id="on" data-testid="register-name" required value={form.name} className="mt-1.5 h-12 rounded-xl"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Jenis usaha</Label>
            <Select value={form.business_type} onValueChange={(v) => setForm({ ...form, business_type: v })}>
              <SelectTrigger data-testid="register-business-type" className="mt-1.5 h-12 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="em">Email</Label>
            <Input id="em" data-testid="register-email" type="email" required value={form.email} className="mt-1.5 h-12 rounded-xl"
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ph">Nomor HP</Label>
            <Input id="ph" data-testid="register-phone" value={form.phone} className="mt-1.5 h-12 rounded-xl"
              placeholder="08xxxxxxxxxx" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div>
          <Label htmlFor="pw">Kata sandi</Label>
          <Input id="pw" data-testid="register-password" type="password" required value={form.password} className="mt-1.5 h-12 rounded-xl"
            placeholder="Minimal 6 karakter" onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <Button type="submit" data-testid="register-submit-button" disabled={loading}
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buat akun"}
        </Button>
      </form>
    </AuthShell>
  );
}
