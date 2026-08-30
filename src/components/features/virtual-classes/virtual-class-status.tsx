import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Programmée",
  OPEN: "Salle ouverte",
  LIVE: "En direct",
  ENDED: "Terminée",
  CANCELLED: "Annulée",
};

export function VirtualClassStatus({ status }: { status: string }) {
  const tone = status === "LIVE" ? "bg-red-100 text-red-700" : status === "OPEN" ? "bg-emerald-100 text-emerald-700" : status === "CANCELLED" ? "bg-slate-200 text-slate-700" : status === "ENDED" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800";
  return <Badge className={tone}>{LABELS[status] ?? status}</Badge>;
}

export function virtualClassStatusLabel(status: string) {
  return LABELS[status] ?? status;
}
