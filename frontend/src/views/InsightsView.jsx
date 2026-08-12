import { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, Info } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Loader } from "@/components/Bits";

const TONES = {
  positive: { cls: "border-emerald-200/70 bg-emerald-50/60", icon: "bg-emerald-100 text-emerald-700", Icon: TrendingUp },
  warning: { cls: "border-amber-200/70 bg-amber-50/60", icon: "bg-amber-100 text-amber-700", Icon: AlertTriangle },
  neutral: { cls: "border-slate-200 bg-white", icon: "bg-slate-100 text-slate-600", Icon: Info },
};

export const InsightsView = ({ businessId }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!businessId) return;
    api.get("/insights", { params: { business_id: businessId } }).then(({ data }) => setData(data)).catch(() => setData(null));
  }, [businessId]);

  if (!data) return <Loader />;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Analisis otomatis dari catatan transaksi Anda, periode {formatDate(data.period.start)} – {formatDate(data.period.end)}.
      </p>
      <div className="grid md:grid-cols-2 gap-4 stagger" data-testid="insights-list">
        {data.insights.map((ins, i) => {
          const t = TONES[ins.tone] || TONES.neutral;
          return (
            <div key={i} data-testid={`insight-card-${i}`} className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all ${t.cls}`}>
              <div className="flex items-start gap-3">
                <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${t.icon}`}>
                  <t.Icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{ins.title}</p>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{ins.text}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
