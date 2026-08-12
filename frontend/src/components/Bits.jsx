import { rupiah, STATUS_LABELS } from "@/lib/format";
import { Clock, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";

export const StatusBadge = ({ status }) => {
  const map = {
    pending: { cls: "bg-amber-50 text-amber-700 border-amber-200/60", Icon: Clock },
    approved: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200/60", Icon: CheckCircle2 },
    needs_correction: { cls: "bg-red-50 text-red-700 border-red-200/60", Icon: AlertTriangle },
  };
  const { cls, Icon } = map[status] || map.pending;
  return (
    <span data-testid={`status-badge-${status}`} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      <Icon className="h-3 w-3" />
      {STATUS_LABELS[status] || status}
    </span>
  );
};

export const TypeBadge = ({ type }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
    type === "income" ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : "bg-red-50 text-red-700 border-red-200/60"
  }`}>
    {type === "income" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
    {type === "income" ? "Uang Masuk" : "Uang Keluar"}
  </span>
);

export const Amount = ({ value, type, className = "" }) => (
  <span className={`font-mono font-bold tabular-nums ${type === "income" ? "text-emerald-600" : "text-red-500"} ${className}`}>
    {type === "income" ? "+" : "-"}
    {rupiah(Math.abs(value)).replace("-", "")}
  </span>
);

export const MetricCard = ({ label, value, sub, Icon, tone = "slate", testId }) => {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-500",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div data-testid={testId} className="relative overflow-hidden bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={`h-9 w-9 rounded-xl grid place-items-center ${tones[tone]}`}>
            <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
        )}
      </div>
      <p className="mt-3 text-xl sm:text-2xl font-mono font-bold tracking-tight text-slate-900 break-words">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
};

export const SectionTitle = ({ title, desc, right }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {desc && <p className="text-sm text-slate-500 mt-1">{desc}</p>}
    </div>
    {right}
  </div>
);

export const EmptyState = ({ title, desc, children }) => (
  <div className="text-center py-14 px-6">
    <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 grid place-items-center">
      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
    </div>
    <p className="mt-4 font-semibold text-slate-800">{title}</p>
    {desc && <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{desc}</p>}
    {children && <div className="mt-5">{children}</div>}
  </div>
);

export const Loader = ({ label = "Memuat data..." }) => (
  <div className="py-16 grid place-items-center gap-3 text-slate-400">
    <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
    <p className="text-sm">{label}</p>
  </div>
);
