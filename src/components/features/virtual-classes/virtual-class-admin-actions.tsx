"use client";

import { Copy, DoorOpen, Pencil, Send, Square, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelVirtualClass,
  deleteVirtualClass,
  duplicateVirtualClass,
  endVirtualClass,
  openVirtualClass,
  sendVirtualClassLinkToLearners,
  type VirtualClassActionResult,
} from "@/server/actions/virtual-classes";

/** Confirmation ouverte, ou `null` quand aucune boîte n'est affichée. */
type PendingConfirmation = "end" | "cancel" | "delete" | "sendLink";

export function VirtualClassAdminActions({ id, status, canDelete }: { id: string; status: string; canDelete: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // `window.alert` / `confirm` / `prompt` bloquaient le fil, sortaient de la
  // charte et sont supprimés par certains navigateurs mobiles : on passe par
  // les primitives déjà utilisées partout ailleurs dans l'application.
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  function close() {
    setConfirmation(null);
    setReason("");
    setReasonError(null);
  }

  function run(action: () => Promise<VirtualClassActionResult>, onSuccess?: (result: VirtualClassActionResult) => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.message ?? "L’opération n’a pas pu aboutir.");
        return;
      }
      toast.success(result.message ?? "Action effectuée.");
      close();
      if (onSuccess) onSuccess(result);
      else router.refresh();
    });
  }

  function submitCancellation() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setReasonError("Précisez le motif de l’annulation (3 caractères minimum).");
      return;
    }
    const data = new FormData();
    data.set("reason", trimmed);
    run(() => cancelVirtualClass(id, data));
  }

  const canSendLink = ["SCHEDULED", "OPEN", "LIVE"].includes(status);

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" || status === "SCHEDULED" ? (
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href={`/admin/classes-virtuelles/${id}/modifier`}><Pencil className="h-4 w-4" />Modifier</Link>
        </Button>
      ) : null}

      {status === "SCHEDULED" ? (
        <Button type="button" className="w-full sm:w-auto" onClick={() => run(() => openVirtualClass(id))} disabled={pending}>
          <DoorOpen className="h-4 w-4" />Ouvrir la salle
        </Button>
      ) : null}

      {status === "OPEN" || status === "LIVE" ? (
        <Button asChild className="w-full sm:w-auto">
          <Link href={`/classes-virtuelles/${id}/verification`}><DoorOpen className="h-4 w-4" />Rejoindre la salle</Link>
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => setConfirmation("sendLink")}
        disabled={pending || !canSendLink}
        title={status === "DRAFT" ? "Programmez la classe avant l’envoi" : undefined}
      >
        <Send className="h-4 w-4" />Envoyer le lien aux apprenants
      </Button>

      {status === "OPEN" || status === "LIVE" ? (
        <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => setConfirmation("end")} disabled={pending}>
          <Square className="h-4 w-4" />Terminer
        </Button>
      ) : null}

      {["DRAFT", "SCHEDULED", "OPEN"].includes(status) ? (
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setConfirmation("cancel")} disabled={pending}>
          <XCircle className="h-4 w-4" />Annuler
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => run(() => duplicateVirtualClass(id), (result) => router.push(`/admin/classes-virtuelles/${result.virtualClassId}/modifier`))}
        disabled={pending}
      >
        <Copy className="h-4 w-4" />Dupliquer
      </Button>

      {canDelete ? (
        <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => setConfirmation("delete")} disabled={pending}>
          <Trash2 className="h-4 w-4" />Supprimer
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmation === "sendLink"}
        onClose={close}
        title="Envoyer le lien d’accès ?"
        description="Tous les apprenants dont l’inscription est active recevront une notification Aiduca et, si l’envoi d’e-mails est configuré, un message."
        confirmLabel="Envoyer le lien"
        pending={pending}
        onConfirm={() => run(() => sendVirtualClassLinkToLearners(id))}
      />

      <ConfirmDialog
        open={confirmation === "end"}
        onClose={close}
        title="Terminer la séance pour tout le monde ?"
        description="La salle est fermée immédiatement et les participants encore connectés en sont sortis. Les temps de présence sont arrêtés et la feuille de présence est figée."
        confirmLabel="Terminer la séance"
        destructive
        pending={pending}
        onConfirm={() => run(() => endVirtualClass(id))}
      />

      <ConfirmDialog
        open={confirmation === "cancel"}
        onClose={close}
        title="Annuler cette séance ?"
        description="Les apprenants inscrits sont prévenus de l’annulation, avec le motif indiqué ci-dessous."
        confirmLabel="Annuler la séance"
        cancelLabel="Revenir"
        destructive
        pending={pending}
        onConfirm={submitCancellation}
      >
        <label htmlFor="cancellation-reason" className="block text-sm font-medium">
          Motif de l’annulation <span aria-hidden className="text-red-600">*</span>
        </label>
        <Textarea
          id="cancellation-reason"
          value={reason}
          onChange={(event) => { setReason(event.target.value); setReasonError(null); }}
          rows={3}
          maxLength={1000}
          required
          aria-invalid={Boolean(reasonError)}
          aria-describedby={reasonError ? "cancellation-reason-error" : undefined}
          className="mt-1"
          placeholder="Formateur indisponible, report au…"
        />
        {reasonError ? (
          <p id="cancellation-reason-error" role="alert" className="mt-1 text-sm text-red-700">{reasonError}</p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmation === "delete"}
        onClose={close}
        title="Supprimer définitivement ce brouillon ?"
        description="Seul un brouillon sans participant ni message peut être supprimé. Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        destructive
        pending={pending}
        onConfirm={() => run(() => deleteVirtualClass(id), () => { router.push("/admin/classes-virtuelles"); router.refresh(); })}
      />
    </div>
  );
}
