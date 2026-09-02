import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, ArrowUpRight, ArrowDownRight, FileCheck2, ScanLine, Sparkles } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { formatThousand, digitsOnly, todayStr, PAYMENT_METHODS } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHIPS = [10000, 50000, 100000, 500000, 1000000];

export const TransactionDialog = ({ open, onOpenChange, businessId, transaction, defaultType = "income", onSaved }) => {
  const editing = Boolean(transaction);
  const [type, setType] = useState(defaultType);
  const [form, setForm] = useState({ date: todayStr(), category: "", amount: "", description: "", payment_method: "Tunai" });
  const [receiptId, setReceiptId] = useState(null);
  const [receiptName, setReceiptName] = useState("");
  const [categories, setCategories] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef(null);
  const suggestTimer = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setType(transaction.type);
      setForm({
        date: transaction.date,
        category: transaction.category,
        amount: formatThousand(String(Math.round(transaction.amount))),
        description: transaction.description || "",
        payment_method: transaction.payment_method || "Tunai",
      });
      setReceiptId(transaction.receipt_id || null);
      setReceiptName(transaction.receipt_id ? "Bukti terlampir" : "");
    } else {
      setType(defaultType);
      setForm({ date: todayStr(), category: "", amount: "", description: "", payment_method: "Tunai" });
      setReceiptId(null);
      setReceiptName("");
      setSuggestion(null);
    }
  }, [open, transaction, defaultType]);

  useEffect(() => {
    if (!open || !businessId) return;
    api.get("/categories", { params: { business_id: businessId } })
      .then(({ data }) => setCategories(data))
      .catch(() => {});
  }, [open, businessId]);

  // Saran kategori otomatis dari deskripsi (rule-based, gratis)
  useEffect(() => {
    if (!open || !businessId || editing) return;
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const text = form.description.trim();
    if (text.length < 3) { setSuggestion(null); return; }
    suggestTimer.current = setTimeout(() => {
      api.get("/categories/suggest", { params: { business_id: businessId, type, text } })
        .then(({ data }) => setSuggestion(data.suggestion))
        .catch(() => setSuggestion(null));
    }, 400);
    return () => suggestTimer.current && clearTimeout(suggestTimer.current);
  }, [form.description, type, open, businessId, editing]);

  const filtered = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/receipts", fd, { params: { business_id: businessId } });
      setReceiptId(data.id);
      setReceiptName(data.filename);
      toast.success("Bukti berhasil diunggah");
      setUploading(false);
      if (/\.(jpe?g|png)$/i.test(file.name)) await scanReceipt(data.id);
    } catch (e) {
      toast.error(apiError(e));
      setUploading(false);
    }
  };

  const scanReceipt = async (id) => {
    setScanning(true);
    try {
      const { data } = await api.post(`/receipts/${id}/extract`);
      if (data.found) {
        setForm((f) => ({
          ...f,
          amount: data.amount ? formatThousand(String(Math.round(data.amount))) : f.amount,
          date: data.date || f.date,
        }));
        const parts = [data.amount && "nominal", data.date && "tanggal"].filter(Boolean).join(" & ");
        toast.success(`Nota terbaca! ${parts.charAt(0).toUpperCase() + parts.slice(1)} terisi otomatis. Periksa lagi ya.`);
      } else {
        toast.info("Nota terunggah, tapi nominal/tanggal tidak terbaca. Silakan isi manual.");
      }
    } catch {
      toast.info("Nota terunggah. Baca otomatis gagal, silakan isi manual.");
    }
    setScanning(false);
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    setForm((f) => ({ ...f, category: suggestion }));
    toast.success(`Kategori "${suggestion}" diterapkan`);
  };

  const submit = async () => {
    const amount = Number(digitsOnly(form.amount));
    if (!amount || amount <= 0) return toast.error("Nominal harus lebih dari 0");
    if (!form.date) return toast.error("Tanggal wajib diisi");
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        type,
        amount,
        description: form.description,
        business_id: businessId,
        receipt_id: receiptId,
        category: form.category || "",
        payment_method: form.payment_method,
      };
      if (editing) await api.put(`/transactions/${transaction.id}`, payload);
      else await api.post("/transactions", payload);
      toast.success(editing ? "Transaksi berhasil diperbarui" : "Transaksi tercatat");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(apiError(e));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[92vh] overflow-y-auto" data-testid="transaction-dialog">
        <DialogHeader>
          <DialogTitle className="text-lg">{editing ? "Ubah Transaksi" : "Catat Transaksi"}</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Isi nominal, tanggal, dan catatan. Kategori & metode opsional. Unggah foto nota agar nominal terisi otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {[
            { v: "income", label: "Uang Masuk", Icon: ArrowUpRight, on: "border-emerald-500 bg-emerald-50 text-emerald-700" },
            { v: "expense", label: "Uang Keluar", Icon: ArrowDownRight, on: "border-red-400 bg-red-50 text-red-600" },
          ].map(({ v, label, Icon, on }) => (
            <button
              key={v}
              data-testid={`type-${v}-button`}
              onClick={() => { setType(v); setForm((f) => ({ ...f, category: "" })); setSuggestion(null); }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                type === v ? on : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="amount">Nominal</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm">Rp</span>
              <Input
                id="amount"
                data-testid="amount-input"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: formatThousand(e.target.value) })}
                placeholder="0"
                className="pl-10 h-12 text-lg font-mono font-bold rounded-xl"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  data-testid={`chip-${c}`}
                  onClick={() => setForm({ ...form, amount: formatThousand(String(c)) })}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  {c.toLocaleString("id-ID")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="desc">Catatan singkat</Label>
            <Textarea id="desc" data-testid="description-input" rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Contoh: jual nasi goreng 5 porsi / beli bensin motor" className="mt-1.5 rounded-xl" />
            {suggestion && !form.category && (
              <button
                data-testid="suggestion-chip"
                onClick={acceptSuggestion}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" /> Saran kategori: <b>{suggestion}</b> · tap untuk pakai
              </button>
            )}
          </div>

          <div>
            <Label htmlFor="date">Tanggal</Label>
            <Input id="date" data-testid="date-input" type="date" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1.5 h-11 rounded-xl" />
          </div>

          <div>
            <Label>Kategori <span className="text-slate-400 font-normal">(opsional)</span></Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger data-testid="category-select" className="mt-1.5 h-11 rounded-xl">
                <SelectValue placeholder="Pilih kategori (boleh kosong)" />
              </SelectTrigger>
              <SelectContent>
                {filtered.map((c) => (
                  <SelectItem key={c.id} value={c.name} data-testid={`category-option-${c.name}`}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Metode Pembayaran</Label>
            <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
              <SelectTrigger data-testid="payment-select" className="mt-1.5 h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Bukti / Nota (JPG, PNG, PDF) — opsional</Label>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
              data-testid="receipt-file-input" onChange={(e) => upload(e.target.files?.[0])} />
            <button
              data-testid="upload-receipt-button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || scanning}
              className="mt-1.5 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors disabled:opacity-70"
            >
              {uploading || scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : receiptId ? <FileCheck2 className="h-4 w-4 text-emerald-600" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Mengunggah..." : scanning ? "Membaca nota..." : receiptId ? receiptName : "Unggah bukti (opsional)"}
            </button>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400" data-testid="ocr-hint">
              <ScanLine className="h-3.5 w-3.5 text-emerald-500" />
              Foto Nota Pintar: nominal & tanggal terisi otomatis dari foto nota (JPG/PNG)
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} data-testid="cancel-transaction-button">Batal</Button>
          <Button data-testid="submit-transaction-button" onClick={submit} disabled={saving}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Simpan Perubahan" : "Simpan Transaksi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
