"use client";

import { Copy, DoorOpen, Pencil, Square, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cancelVirtualClass, deleteVirtualClass, duplicateVirtualClass, endVirtualClass, openVirtualClass } from "@/server/actions/virtual-classes";

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

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" || status === "SCHEDULED" ? <Button asChild variant="outline"><Link href={`/admin/classes-virtuelles/${id}/modifier`}><Pencil className="h-4 w-4" />Modifier</Link></Button> : null}
      {status === "SCHEDULED" ? <Button type="button" onClick={() => run(() => openVirtualClass(id))} disabled={pending}><DoorOpen className="h-4 w-4" />Ouvrir la salle</Button> : null}
      {status === "OPEN" || status === "LIVE" ? <Button type="button" variant="destructive" onClick={() => window.confirm("Terminer la séance pour tous les participants ?") && run(() => endVirtualClass(id))} disabled={pending}><Square className="h-4 w-4" />Terminer</Button> : null}
      {["DRAFT", "SCHEDULED", "OPEN"].includes(status) ? <Button type="button" variant="outline" onClick={cancel} disabled={pending}><XCircle className="h-4 w-4" />Annuler</Button> : null}
      <Button type="button" variant="outline" onClick={duplicate} disabled={pending}><Copy className="h-4 w-4" />Dupliquer</Button>
      {canDelete ? <Button type="button" variant="destructive" onClick={remove} disabled={pending}><Trash2 className="h-4 w-4" />Supprimer</Button> : null}
    </div>
  );
}
