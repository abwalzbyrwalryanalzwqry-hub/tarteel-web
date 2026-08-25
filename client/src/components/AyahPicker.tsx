import { Hash, PencilLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { label: string; value: number; max: number; onChange: (value: number) => void };

export function AyahPicker({ label, value, max, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [manualValue, setManualValue] = useState(String(value));
  useEffect(() => setManualValue(String(value)), [value]);
  const selectAyah = (ayah: number) => { onChange(ayah); setOpen(false); };
  const submitManual = () => {
    const number = Math.max(1, Math.min(max, Number(manualValue) || 1));
    selectAyah(number);
  };

  return <div className="min-w-0"><label className="mb-1 block text-xs text-muted-foreground">{label} <span className="text-muted-foreground/70">(1–{max})</span></label><button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-between rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10"><span>الآية {value}</span><Hash className="h-4 w-4 text-primary" /></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl" dir="rtl"><DialogHeader><DialogTitle className="font-display text-xl">{label}</DialogTitle><DialogDescription>انقر رقم الآية المطلوبة، أو أدخله يدوياً ضمن آيات السورة المختارة.</DialogDescription></DialogHeader><div className="grid grid-cols-5 gap-2 sm:grid-cols-8">{Array.from({ length: max }, (_, index) => index + 1).map((ayah) => <button type="button" key={ayah} onClick={() => selectAyah(ayah)} className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition-colors ${ayah === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40 hover:bg-primary/5"}`}>{ayah}</button>)}</div><div className="rounded-2xl border border-border bg-muted/30 p-3"><label className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><PencilLine className="h-4 w-4 text-primary" />إدخال يدوي</label><div className="flex gap-2"><input dir="ltr" inputMode="numeric" value={manualValue} onChange={(event) => setManualValue(event.target.value.replace(/\D/g, ""))} className="tarteel-input min-w-0 text-center" /><button type="button" onClick={submitManual} className="btn-gold shrink-0 px-4">تأكيد</button></div></div></DialogContent></Dialog></div>;
}
