"use client";

import { Copy, DoorOpen, Pencil, Send, Square, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cancelVirtualClass, deleteVirtualClass, duplicateVirtualClass, endVirtualClass, openVirtualClass, sendVirtualClassLinkToLearners } from "@/server/actions/virtual-classes";

export function VirtualClassAdminActions({ id, status, canDelete }: { id: string; status: string; canDelete: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateVirtualClass(id);
      if (!result.success) return window.alert(result.message);
      router.push(`/admin/classes-virtuelles/${result.virtualClassId}/modifier`);
    });
  }

  function remove() {
    if (!window.confirm("Supprimer définitivement ce brouillon ?")) return;
    startTransition(async () => {
      const result = await deleteVirtualClass(id);
      if (!result.success) return window.alert(result.message);
      router.push("/admin/classes-virtuelles");
      router.refresh();
    });
  }

  function run(action: () => Promise<{ success: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) return window.alert(result.message);
      router.refresh();
    });
  }

  function cancel() {
    const reason = window.prompt("Motif de l’annulation (obligatoire) :")?.trim();
    if (!reason) return;
    const data = new FormData();
    data.set("reason", reason);
    run(() => cancelVirtualClass(id, data));
  }

  function sendLink() {
    if (!window.confirm("Envoyer le lien d’accès à tous les apprenants actifs de cette session ?")) return;
    startTransition(async () => {
      const result = await sendVirtualClassLinkToLearners(id);
      window.alert(result.message ?? (result.success ? "Lien envoyé." : "L’envoi a échoué."));
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" || status === "SCHEDULED" ? <Button asChild variant="outline"><Link href={`/admin/classes-virtuelles/${id}/modifier`}><Pencil className="h-4 w-4" />Modifier</Link></Button> : null}
      {status === "SCHEDULED" ? <Button type="button" onClick={() => run(() => openVirtualClass(id))} disabled={pending}><DoorOpen className="h-4 w-4" />Ouvrir la salle</Button> : null}
      {status === "OPEN" || status === "LIVE" ? <Button asChild><Link href={`/classes-virtuelles/${id}/verification`}><DoorOpen className="h-4 w-4" />Rejoindre la salle</Link></Button> : null}
      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={sendLink} disabled={pending || !["SCHEDULED", "OPEN", "LIVE"].includes(status)} title={status === "DRAFT" ? "Programmez la classe avant l’envoi" : undefined}><Send className="h-4 w-4" />Envoyer le lien aux apprenants</Button>
      {status === "OPEN" || status === "LIVE" ? <Button type="button" variant="destructive" onClick={() => window.confirm("Terminer la séance pour tous les participants ?") && run(() => endVirtualClass(id))} disabled={pending}><Square className="h-4 w-4" />Terminer</Button> : null}
      {["DRAFT", "SCHEDULED", "OPEN"].includes(status) ? <Button type="button" variant="outline" onClick={cancel} disabled={pending}><XCircle className="h-4 w-4" />Annuler</Button> : null}
      <Button type="button" variant="outline" onClick={duplicate} disabled={pending}><Copy className="h-4 w-4" />Dupliquer</Button>
      {canDelete ? <Button type="button" variant="destructive" onClick={remove} disabled={pending}><Trash2 className="h-4 w-4" />Supprimer</Button> : null}
    </div>
  );
}
