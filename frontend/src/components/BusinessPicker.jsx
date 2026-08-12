import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loader } from "@/components/Bits";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const BusinessPicker = ({ value, onChange }) => {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get("/businesses").then(({ data }) => {
      setRows(data);
      if (!value && data.length) onChange(data[0].id);
    }).catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (rows === null) return <Loader label="Memuat daftar UMKM..." />;
  if (rows.length === 0) return <p className="text-slate-500 text-sm">Belum ada UMKM.</p>;

  return (
    <div className="card-soft p-4 sm:p-5 max-w-sm">
      <Label className="text-xs">Pilih UMKM</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger data-testid="business-picker" className="mt-1.5 h-11 rounded-xl"><SelectValue placeholder="Pilih UMKM" /></SelectTrigger>
        <SelectContent>
          {rows.map((b) => <SelectItem key={b.id} value={b.id} data-testid={`picker-option-${b.name}`}>{b.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};
