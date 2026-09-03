// Lapisan penyimpanan lokal (offline) berbasis IndexedDB via localforage.
// Menggantikan MongoDB + FastAPI. Semua data disimpan di komputer pengguna.
import localforage from "localforage";

export const UNCATEGORIZED = "Belum Dikategorikan";

export const DEFAULT_CATEGORIES = [
  ["income", "Belum Dikategorikan"],
  ["income", "Penjualan"],
  ["income", "Pendapatan Jasa"],
  ["income", "Pendapatan Lain"],
  ["income", "Suntikan Modal"],
  ["expense", "Belum Dikategorikan"],
  ["expense", "Stok / Bahan"],
  ["expense", "Gaji"],
  ["expense", "Sewa"],
  ["expense", "Listrik"],
  ["expense", "Internet"],
  ["expense", "Transportasi"],
  ["expense", "Pemasaran"],
  ["expense", "Perlengkapan"],
  ["expense", "Biaya Operasional"],
  ["expense", "Pengeluaran Lain"],
];

const store = localforage.createInstance({ name: "kasumkm", storeName: "data" });

export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const nowIso = () => new Date().toISOString();

export async function getAll(key) {
  return (await store.getItem(key)) || [];
}

export async function setAll(key, arr) {
  await store.setItem(key, arr);
  return arr;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthBounds(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return [ymd(start), ymd(end)];
}

export function shiftMonth(ref, months) {
  return new Date(ref.getFullYear(), ref.getMonth() + months, 1);
}

export function monthLabel(d) {
  return d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

export function dayBefore(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

// Hitung total (hanya transaksi approved & belum dihapus) untuk 1 usaha dalam rentang.
export function approvedTotals(txs, bid, start, end) {
  const rows = txs.filter(
    (t) =>
      !t.is_deleted &&
      t.status === "approved" &&
      t.business_id === bid &&
      (!start || t.date >= start) &&
      (!end || t.date <= end)
  );
  const income = rows.filter((r) => r.type === "income").reduce((a, b) => a + b.amount, 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((a, b) => a + b.amount, 0);
  return { income, expense, rows };
}

export function byCategory(rows, kind) {
  const agg = {};
  rows.forEach((r) => {
    if (r.type === kind) agg[r.category] = (agg[r.category] || 0) + r.amount;
  });
  const total = Object.values(agg).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(agg)
    .map(([name, amount]) => ({ name, amount, percentage: (amount / total) * 100 }))
    .sort((a, b) => b.amount - a.amount);
}
