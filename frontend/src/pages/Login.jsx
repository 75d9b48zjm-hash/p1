import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Wallet, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen grid lg:grid-cols-2">
    <div className="hidden lg:flex flex-col justify-between bg-slate-900 p-12 relative overflow-hidden">
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_20%,#059669,transparent_45%),radial-gradient(circle_at_80%_70%,#0EA5E9,transparent_40%)]" />
      <div className="relative flex items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-emerald-500 grid place-items-center">
          <Wallet className="h-5 w-5 text-white" strokeWidth={2.4} />
        </span>
        <p className="text-white font-bold text-lg">KasUMKM</p>
      </div>
      <div className="relative max-w-md">
        <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight tracking-tight">
          Semudah mencatat di buku, otomatis jadi laporan keuangan.
        </h2>
        <p className="text-slate-300 mt-5 leading-relaxed">
          Catat uang masuk dan uang keluar dalam hitungan detik. Tim pembukuan kami memeriksa dan merapikan datanya untuk Anda.
        </p>
        <div className="mt-8 space-y-2.5 text-sm text-slate-300">
          {["Tanpa istilah akuntansi yang membingungkan", "Laporan laba, arus kas, dan analisis usaha otomatis", "Unggah foto nota langsung dari HP"].map((t) => (
            <p key={t} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t}</p>
          ))}
        </div>
      </div>
      <p className="relative text-xs text-slate-500">Pembukuan sederhana untuk UMKM Indonesia</p>
    </div>

    <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <span className="h-9 w-9 rounded-xl bg-emerald-500 grid place-items-center">
            <Wallet className="h-5 w-5 text-white" />
          </span>
          <p className="font-bold text-slate-900">KasUMKM</p>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-2">{subtitle}</p>
        <div className="mt-7 space-y-4">{children}</div>
        {footer && <div className="mt-6 text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  </div>
);

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Selamat datang, ${user.name}`);
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      toast.error(apiError(err));
    }
    setLoading(false);
  };

  const quick = (email, password) => setForm({ email, password });

  return (
    <AuthShell
      title="Masuk ke akun Anda"
      subtitle="Kelola pembukuan usaha Anda dengan mudah."
      footer={<>Belum punya akun? <Link to="/register" className="font-semibold text-emerald-600 hover:underline" data-testid="link-register">Daftar UMKM</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" data-testid="login-email-input" type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@usaha.id" className="mt-1.5 h-12 rounded-xl" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Kata sandi</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-emerald-600 hover:underline" data-testid="link-forgot">Lupa kata sandi?</Link>
          </div>
          <Input id="password" data-testid="login-password-input" type="password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="mt-1.5 h-12 rounded-xl" />
        </div>
        <Button type="submit" data-testid="login-submit-button" disabled={loading}
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Masuk <ArrowRight className="h-4 w-4 ml-1.5" /></>}
        </Button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Akun demo</p>
        <div className="mt-2.5 space-y-2">
          <button data-testid="demo-admin-button" onClick={() => quick("admin@kasumkm.id", "admin123")}
            className="w-full text-left px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 transition-colors">
            <p className="text-sm font-semibold text-slate-800">Admin / Pembukuan</p>
            <p className="text-xs text-slate-500">admin@kasumkm.id · admin123</p>
          </button>
          <button data-testid="demo-msme-button" onClick={() => quick("toko.maju@demo.id", "demo123")}
            className="w-full text-left px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 transition-colors">
            <p className="text-sm font-semibold text-slate-800">Pemilik UMKM (Toko Maju)</p>
            <p className="text-xs text-slate-500">toko.maju@demo.id · demo123</p>
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
