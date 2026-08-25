"use client";

import { Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PROGRAM_NOT_DELETABLE_MESSAGE } from "@/lib/domain/program-deletion";
import { deleteProgram } from "@/server/actions/admin-programs";

interface ProgramDeleteButtonProps {
  programId: string;
  programTitle: string;
  deletable: boolean;
  returnToList?: boolean;
  presentation?: "button" | "compact";
}

export function ProgramDeleteButton({
  programId,
  programTitle,
  deletable,
  returnToList = false,
  presentation = "button",
}: ProgramDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!deletable && presentation === "compact") {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link
          href={`/admin/formations/${programId}#program-information`}
          aria-label={`Archiver le programme ${programTitle}. ${PROGRAM_NOT_DELETABLE_MESSAGE}`}
          className="text-amber-800 hover:bg-amber-50 hover:text-amber-950 dark:text-amber-200 dark:hover:bg-amber-500/10"
        >
          <Archive className="h-4 w-4" aria-hidden />
          Archiver
        </Link>
      </Button>
    );
  }

  function remove() {
    startTransition(async () => {
      setMessage(null);
      const result = await deleteProgram(programId);
      if (!result.success) {
        setMessage(result.message ?? "Échec de la suppression.");
        return;
      }
      setOpen(false);
      if (returnToList) router.push("/admin/formations");
      else router.refresh();
    });
  }

  return (
    <div className={presentation === "compact" ? "space-y-1" : "space-y-2"}>
      <Button
        type="button"
        variant={presentation === "compact" ? "ghost" : "outline"}
        size={presentation === "compact" ? "sm" : "default"}
        disabled={!deletable || pending}
        onClick={() => setOpen(true)}
        aria-label={`Supprimer le programme ${programTitle}`}
        title={!deletable ? PROGRAM_NOT_DELETABLE_MESSAGE : undefined}
        className={
          presentation === "compact"
            ? "text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-500/10"
            : "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
        }
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Supprimer
      </Button>

      {!deletable && presentation !== "compact" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p>{PROGRAM_NOT_DELETABLE_MESSAGE}</p>
          <Link href="#program-information" className="mt-2 inline-flex items-center gap-1 font-semibold underline">
            <Archive className="h-3.5 w-3.5" aria-hidden />
            Choisir le statut « Archivé »
          </Link>
        </div>
      ) : null}

      {message ? <p className="text-xs text-red-700 dark:text-red-300" role="alert">{message}</p> : null}

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Supprimer « ${programTitle} » ?`}
        description="Cette action est irréversible. Le programme et sa composition seront supprimés. Les cours qui le composent seront conservés."
        confirmLabel="Supprimer définitivement"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
