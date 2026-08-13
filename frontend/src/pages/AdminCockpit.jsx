import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, Inbox, ChevronRight, Zap, Keyboard, Loader2, Paperclip } from "lucide-react";
import api, { apiError, API } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { Loader, EmptyState, Amount } from "@/components/Bits";
import { formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

const useSuggestion = (businessId, type, text) => {
  const [suggestion, setSuggestion] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    if (!businessId || !text || text.length < 3) { setSuggestion(null); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.get("/categories/suggest", { params: { business_id: businessId, type, text } })
        .then(({ data }) => setSuggestion(data.suggestion))
        .catch(() => setSuggestion(null));
    }, 300);
    return () => timer.current && clearTimeout(timer.current);
  }, [businessId, type, text]);
  return suggestion;
};

export default function AdminCockpit() {
  const [rows, setRows] = useState(null);
  const [categoriesByBiz, setCategoriesByBiz] = useState({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pickedCategory, setPickedCategory] = useState("");

  const load = useCallback(async () => {
    const { data } = await api.get("/transactions", { params: { status: "pending", sort: "oldest", limit: 500 } });
    setRows(data);
    setActiveIdx(0);
    setPickedCategory("");
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = rows?.[activeIdx];

  useEffect(() => {
    if (!active) return;
    const bid = active.business_id;
    if (categoriesByBiz[bid]) return;
    api.get("/categories", { params: { business_id: bid } })
      .then(({ data }) => setCategoriesByBiz((m) => ({ ...m, [bid]: data })))
      .catch(() => {});
  }, [active, categoriesByBiz]);

  useEffect(() => {
    setPickedCategory(active?.category && active.category !== "Belum Dikategorikan" ? active.category : "");
  }, [active]);

  const suggestion = useSuggestion(active?.business_id, active?.type, active?.description || "");

  const availableCategories = useMemo(() => {
    if (!active) return [];
    return (categoriesByBiz[active.business_id] || [])
      .filter((c) => c.type === active.type && c.name !== "Belum Dikategorikan");
  }, [active, categoriesByBiz]);

  const approve = useCallback(async (category) => {
    if (!active) return;
    if (!category) { toast.error("Pilih kategori dulu"); return; }
    setSaving(true);
    try {
      await api.post(`/transactions/${active.id}/review`, { status: "approved", category });
      toast.success(`Disetujui sebagai "${category}"`);
      // Optimistic: hapus dari list, geser ke selanjutnya
      setRows((r) => {
        const next = r.filter((_, i) => i !== activeIdx);
        return next;
      });
      setActiveIdx((i) => Math.min(i, (rows?.length || 1) - 2));
      setPickedCategory("");
    } catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  }, [active, activeIdx, rows]);

  const openReceipt = (id) => {
    const token = localStorage.getItem("kasumkm_token");
    window.open(`${API}/receipts/${id}?auth_token=${token}`, "_blank");
  };

  // Keyboard shortcuts: Enter = approve dengan kategori terpilih (atau saran), 1-9 = pilih kategori ke-N, ↑↓ = navigasi
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (!rows || rows.length === 0) return;
      if (e.key === "ArrowDown") { setActiveIdx((i) => Math.min(i + 1, rows.length - 1)); e.preventDefault(); }
      else if (e.key === "ArrowUp") { setActiveIdx((i) => Math.max(i - 1, 0)); e.preventDefault(); }
      else if (e.key === "Enter") {
        const cat = pickedCategory || suggestion;
        if (cat) { approve(cat); e.preventDefault(); }
      } else if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const cat = availableCategories[idx];
        if (cat) { setPickedCategory(cat.name); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, activeIdx, pickedCategory, suggestion, availableCategories, approve]);

  return (
    <Layout title="Cockpit Kategorisasi" subtitle="Kelompokkan transaksi UMKM dengan cepat — pakai keyboard untuk lebih ngebut">
      {rows === null ? <Loader /> : rows.length === 0 ? (
        <div className="card-soft">
          <EmptyState title="Semua sudah rapi! 🎉" desc="Tidak ada transaksi menunggu tinjauan saat ini." />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[380px_1fr] gap-5">
          {/* Inbox kiri */}
          <div className="card-soft overflow-hidden max-h-[70vh] flex flex-col" data-testid="cockpit-inbox">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0">
              <Inbox className="h-4 w-4 text-slate-500" />
              <p className="text-sm font-semibold text-slate-700">Antrian ({rows.length})</p>
            </div>
            <div className="overflow-y-auto divide-y divide-slate-100">
              {rows.map((t, i) => (
                <button
                  key={t.id}
                  data-testid={`cockpit-row-${t.id}`}
                  onClick={() => setActiveIdx(i)}
                  className={`w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-slate-50 transition-colors ${
                    i === activeIdx ? "bg-emerald-50/70 border-l-4 border-l-emerald-500" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-emerald-700 truncate">{t.business_name}</p>
                    <p className="text-sm font-medium text-slate-800 truncate mt-0.5">{t.description || "(tanpa catatan)"}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(t.date)} · {t.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Amount value={t.amount} type={t.type} className="text-xs" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail kanan */}
          {active ? (
            <div className="card-soft p-5 sm:p-6 space-y-5" data-testid="cockpit-detail">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-emerald-700">{active.business_name}</p>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{active.description || "(tanpa catatan)"}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDate(active.date)} · {active.payment_method} · dibuat {formatDateTime(active.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <Amount value={active.amount} type={active.type} className="text-xl" />
                  <p className="text-[11px] text-slate-400 mt-0.5">Kategori awal: {active.category}</p>
                </div>
              </div>

              {active.receipt_id && (
                <Button variant="outline" size="sm" className="rounded-xl" data-testid="cockpit-view-receipt"
                  onClick={() => openReceipt(active.receipt_id)}>
                  <Paperclip className="h-3.5 w-3.5 mr-1.5" /> Lihat bukti nota
                </Button>
              )}

              {suggestion && (
                <button
                  data-testid="cockpit-suggestion"
                  onClick={() => setPickedCategory(suggestion)}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    pickedCategory === suggestion
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Saran: <b>{suggestion}</b></span>
                  <span className="ml-auto text-[11px] font-normal opacity-75">berdasarkan histori</span>
                </button>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Pilih kategori {active.type === "income" ? "pemasukan" : "pengeluaran"}:</p>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.length === 0 && (
                    <p className="text-xs text-slate-400">Belum ada kategori. Buat dulu di menu Kategori.</p>
                  )}
                  {availableCategories.map((c, i) => (
                    <button
                      key={c.id}
                      data-testid={`cockpit-cat-${c.name}`}
                      onClick={() => setPickedCategory(c.name)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                        pickedCategory === c.name
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                      }`}
                    >
                      {i < 9 && <kbd className="bg-slate-100 text-slate-500 text-[10px] rounded px-1 font-mono">{i + 1}</kbd>}
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                <Button
                  data-testid="cockpit-approve"
                  onClick={() => approve(pickedCategory || suggestion)}
                  disabled={saving || (!pickedCategory && !suggestion)}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-5"
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Setujui & Kelompokkan
                </Button>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Keyboard className="h-3.5 w-3.5" /> Tekan <kbd className="mx-1 px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px]">Enter</kbd> untuk setujui,
                  <kbd className="mx-1 px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px]">1-9</kbd> pilih kategori,
                  <kbd className="mx-1 px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px]">↑↓</kbd> navigasi
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                <span>Transaksi {activeIdx + 1} dari {rows.length}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" data-testid="cockpit-prev"
                    disabled={activeIdx === 0} onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}>Sebelumnya</Button>
                  <Button variant="ghost" size="sm" data-testid="cockpit-next"
                    disabled={activeIdx >= rows.length - 1} onClick={() => setActiveIdx((i) => Math.min(rows.length - 1, i + 1))}>
                    Selanjutnya <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-soft p-6"><EmptyState title="Pilih transaksi" desc="Klik salah satu dari antrian untuk mulai." /></div>
          )}
        </div>
      )}
    </Layout>
  );
}
