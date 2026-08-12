import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Loader, EmptyState } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const CategoriesView = ({ businessId }) => {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ name: "", type: "expense" });

  const load = useCallback(() => {
    if (!businessId) return;
    api.get("/categories", { params: { business_id: businessId } }).then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Nama kategori wajib diisi");
    try {
      await api.post("/categories", { ...form, business_id: businessId });
      toast.success("Kategori ditambahkan");
      setForm({ name: "", type: form.type });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/categories/${id}`);
      toast.success("Kategori dihapus");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  if (rows === null) return <Loader />;

  const groups = [
    { type: "income", label: "Kategori Uang Masuk", tone: "text-emerald-700 bg-emerald-50" },
    { type: "expense", label: "Kategori Uang Keluar", tone: "text-red-600 bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="card-soft p-5 sm:p-6">
        <p className="font-semibold text-slate-800 mb-4">Tambah kategori baru</p>
        <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
          <div>
            <Label className="text-xs">Nama kategori</Label>
            <Input data-testid="category-name-input" value={form.name} className="mt-1 h-11 rounded-xl"
              placeholder="Contoh: Kemasan" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Jenis</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger data-testid="category-type-select" className="mt-1 h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Uang Masuk</SelectItem>
                <SelectItem value="expense">Uang Keluar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button data-testid="add-category-button" onClick={add} className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Tambah
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {groups.map((g) => {
          const items = rows.filter((r) => r.type === g.type);
          return (
            <div key={g.type} className="card-soft p-5 sm:p-6" data-testid={`category-group-${g.type}`}>
              <p className="font-semibold text-slate-800 mb-3">{g.label}</p>
              {items.length === 0 ? <EmptyState title="Belum ada kategori" /> : (
                <div className="flex flex-wrap gap-2">
                  {items.map((c) => (
                    <span key={c.id} className={`inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-sm font-medium ${g.tone}`}>
                      {c.name}
                      <button data-testid={`delete-category-${c.name}`} onClick={() => remove(c.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
