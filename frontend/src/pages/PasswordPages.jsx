import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/pages/Login";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      toast.success(data.message);
      setToken(data.dev_token);
    } catch (err) {
      toast.error(apiError(err));
    }
    setLoading(false);
  };

  return (
    <AuthShell
      title="Lupa kata sandi"
      subtitle="Masukkan email Anda, kami kirimkan tautan untuk membuat kata sandi baru."
      footer={<Link to="/login" className="font-semibold text-emerald-600 hover:underline" data-testid="back-to-login">Kembali ke halaman masuk</Link>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="fe">Email</Label>
          <Input id="fe" data-testid="forgot-email-input" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-12 rounded-xl" />
        </div>
        <Button type="submit" data-testid="forgot-submit-button" disabled={loading}
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim tautan reset"}
        </Button>
      </form>
      {token && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm" data-testid="dev-reset-link">
          <p className="font-semibold text-emerald-800">Tautan reset (mode pengembangan)</p>
          <Link className="text-emerald-700 underline break-all" to={`/reset-password?token=${token}`}>/reset-password?token={token}</Link>
        </div>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const token = params.get("token") || "";

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Kata sandi minimal 6 karakter");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Kata sandi berhasil diubah, silakan masuk.");
      navigate("/login");
    } catch (err) {
      toast.error(apiError(err));
    }
    setLoading(false);
  };

  return (
    <AuthShell title="Buat kata sandi baru" subtitle="Masukkan kata sandi baru untuk akun Anda."
      footer={<Link to="/login" className="font-semibold text-emerald-600 hover:underline">Kembali ke halaman masuk</Link>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="np">Kata sandi baru</Label>
          <Input id="np" data-testid="reset-password-input" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-12 rounded-xl" />
        </div>
        <Button type="submit" data-testid="reset-submit-button" disabled={loading || !token}
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan kata sandi"}
        </Button>
        {!token && <p className="text-sm text-red-500">Tautan reset tidak valid.</p>}
      </form>
    </AuthShell>
  );
}
