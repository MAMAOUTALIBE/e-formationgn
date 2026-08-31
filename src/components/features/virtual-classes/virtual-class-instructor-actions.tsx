"use client";

import { DoorOpen, Send, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { openVirtualClass, sendVirtualClassLinkToLearners } from "@/server/actions/virtual-classes";

export function VirtualClassInstructorActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingLink, setConfirmingLink] = useState(false);

  function open() {
    startTransition(async () => {
      const result = await openVirtualClass(id);
      if (!result.success) {
        toast.error(result.message ?? "La salle n’a pas pu être ouverte.");
        return;
      }
      toast.success(result.message ?? "Salle ouverte.");
      router.push(`/classes-virtuelles/${id}/verification`);
      router.refresh();
    });
  }

  function sendLink() {
    startTransition(async () => {
      const result = await sendVirtualClassLinkToLearners(id);
      if (!result.success) {
        toast.error(result.message ?? "L’envoi a échoué.");
        return;
      }
      toast.success(result.message ?? "Lien envoyé.");
      setConfirmingLink(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href={`/classes-virtuelles/${id}/verification`}><SlidersHorizontal className="h-4 w-4" />Préparer la séance</Link>
      </Button>
      {status === "SCHEDULED" ? (
        <Button type="button" className="w-full sm:w-auto" disabled={pending} onClick={open}>
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
        onClick={() => setConfirmingLink(true)}
        disabled={pending || !["SCHEDULED", "OPEN", "LIVE"].includes(status)}
        title={status === "DRAFT" ? "Programmez la classe avant l’envoi" : undefined}
      >
        <Send className="h-4 w-4" />Envoyer le lien aux apprenants
      </Button>

      <ConfirmDialog
        open={confirmingLink}
        onClose={() => setConfirmingLink(false)}
        title="Envoyer le lien d’accès ?"
        description="Tous les apprenants dont l’inscription est active recevront une notification Aiduca et, si l’envoi d’e-mails est configuré, un message."
        confirmLabel="Envoyer le lien"
        pending={pending}
        onConfirm={sendLink}
      />
    </div>
  );
}
