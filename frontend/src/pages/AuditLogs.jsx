import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Layout } from "@/components/Layout";
import { Loader, EmptyState } from "@/components/Bits";

const ACTION_LABELS = {
  transaction_created: "Transaksi dibuat",
  transaction_updated: "Transaksi diubah",
  transaction_approved: "Transaksi disetujui",
  transaction_rejected: "Transaksi perlu perbaikan",
  transaction_deleted: "Transaksi dihapus",
  category_changed: "Kategori diubah",
  category_created: "Kategori dibuat",
  category_deleted: "Kategori dihapus",
  business_created: "UMKM dibuat",
  business_updated: "Profil usaha diperbarui",
};

const val = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return Object.entries(v).map(([k, x]) => `${k}: ${x}`).join(", ");
  return String(v);
};

export default function AuditLogs() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get("/audit-logs", { params: { limit: 200 } }).then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, []);

  return (
    <Layout title="Log Audit" subtitle="Jejak semua perubahan penting pada data keuangan">
      {rows === null ? <Loader /> : rows.length === 0 ? (
        <div className="card-soft"><EmptyState title="Belum ada aktivitas" /></div>
      ) : (
        <div className="card-soft divide-y divide-slate-100 overflow-hidden" data-testid="audit-log-list">
          {rows.map((r) => (
            <div key={r.id} className="p-4 sm:p-5 flex gap-4" data-testid={`audit-item-${r.id}`}>
              <span className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500 grid place-items-center shrink-0">
                <ScrollText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{ACTION_LABELS[r.action] || r.action}</p>
                  {r.business_name && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{r.business_name}</span>}
                </div>
                <p className="text-xs text-slate-600 mt-1">{r.label}</p>
                {(val(r.old_value) || val(r.new_value)) && (
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {val(r.old_value) && <span className="line-through">{val(r.old_value)}</span>}
                    {val(r.old_value) && val(r.new_value) && " → "}
                    {val(r.new_value)}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5">{r.user_name} ({r.user_role}) · {formatDateTime(r.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
