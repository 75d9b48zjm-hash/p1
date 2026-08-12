export function rupiah(value, opts = {}) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : opts.plus && n > 0 ? "+" : "";
  return `${sign}Rp${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;
}

export function rupiahShort(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}Rp${(abs / 1e9).toFixed(1)}M`;
  if (abs >= 1e6) return `${sign}Rp${(abs / 1e6).toFixed(1)}jt`;
  if (abs >= 1e3) return `${sign}Rp${Math.round(abs / 1e3)}rb`;
  return `${sign}Rp${abs}`;
}

export function digitsOnly(str) {
  return String(str || "").replace(/\D/g, "");
}

export function formatThousand(str) {
  const d = digitsOnly(str);
  if (!d) return "";
  return Number(d).toLocaleString("id-ID");
}

export function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function relativeDays(iso) {
  if (!iso) return "Belum ada aktivitas";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Hari ini";
  if (days === 1) return "Kemarin";
  return `${days} hari lalu`;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

export const STATUS_LABELS = {
  pending: "Perlu Tinjauan",
  approved: "Disetujui",
  needs_correction: "Perlu Perbaikan",
};

export const BUSINESS_STATUS = {
  active: { label: "Aktif", cls: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
  needs_attention: { label: "Perlu Perhatian", cls: "bg-amber-50 text-amber-700 border-amber-200/60" },
  no_activity: { label: "Tidak Ada Aktivitas", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const BUSINESS_TYPES = ["Retail", "Makanan & Minuman", "Toko Online", "Jasa", "Freelance", "Lainnya"];
export const PAYMENT_METHODS = ["Tunai", "Transfer Bank", "QRIS", "E-wallet", "Lainnya"];
