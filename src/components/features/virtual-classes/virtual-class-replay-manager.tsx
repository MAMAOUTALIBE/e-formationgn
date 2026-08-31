"use client";

import { Eye, EyeOff, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { VIRTUAL_CLASS_REPLAY_RETENTION_DAYS } from "@/lib/domain/virtual-class";
import { formatVirtualClassDate } from "@/lib/virtual-class-display";
import { publishVirtualClassReplay } from "@/server/actions/virtual-classes";

interface Recording { id: string; status: string; visible: boolean; durationSeconds: number; technicalError: string | null; expiresAt: Date | null }

export function VirtualClassReplayManager({ virtualClassId, recordings }: { virtualClassId: string; recordings: Recording[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function publish(id: string, visible: boolean) {
    startTransition(async () => {
      const result = await publishVirtualClassReplay(id, visible);
      if (!result.success) {
        toast.error(result.message ?? "L’opération n’a pas pu aboutir.");
        return;
      }
      toast.success(result.message ?? "Replay mis à jour.");
      router.refresh();
    });
  }
  return <div className="space-y-2">{recordings.map((recording) => <div key={recording.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><PlayCircle className="h-5 w-5" /><strong className="text-sm">{recording.status}</strong>{recording.durationSeconds ? <span className="text-xs text-muted-foreground">{Math.round(recording.durationSeconds / 60)} min</span> : null}<span className="ml-auto text-xs text-muted-foreground">{recording.visible ? "Publié" : "Privé"}</span></div>{recording.technicalError ? <p className="mt-2 text-xs text-red-700">Le traitement a échoué.</p> : null}{recording.expiresAt ? <p className="mt-2 text-xs text-muted-foreground">Conservation jusqu’au {formatVirtualClassDate(recording.expiresAt)} · supprimé automatiquement ensuite.</p> : recording.status === "READY" ? <p className="mt-2 text-xs text-muted-foreground">Sera conservé {VIRTUAL_CLASS_REPLAY_RETENTION_DAYS} jours après publication.</p> : null}<div className="mt-2 flex flex-wrap gap-2">{recording.status === "READY" ? <Button asChild variant="outline" size="sm"><a href={`/api/classes-virtuelles/${virtualClassId}/replay/${recording.id}`} target="_blank" rel="noreferrer"><PlayCircle className="h-4 w-4" />Lire</a></Button> : null}{recording.status === "READY" ? <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => publish(recording.id, !recording.visible)}>{recording.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{recording.visible ? "Rendre privé" : "Publier"}</Button> : null}</div></div>)}{!recordings.length ? <p className="text-sm text-muted-foreground">Aucun enregistrement.</p> : null}</div>;
}
