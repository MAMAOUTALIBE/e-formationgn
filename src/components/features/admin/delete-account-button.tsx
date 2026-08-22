"use client";

// Suppression définitive d'un compte apprenant.
//
// Distincte de la demande RGPD voisine, qui archive : ici la ligne disparaît
// de la base avec tout ce qui en dépend. Le geste étant sans retour, il ne se
// déclenche pas sur un simple clic — il faut retaper l'adresse du compte.
// Une boîte de confirmation se valide par réflexe ; recopier l'adresse oblige
// à regarder QUEL compte on s'apprête à effacer.

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteLearnerAccount } from "@/server/actions/admin-accounts";

export function DeleteAccountButton({
  userId,
  email,
  certificatesCount,
  enrollmentsCount,
}: {
  userId: string;
  email: string;
  certificatesCount: number;
  enrollmentsCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  function handleDelete() {
    if (!matches) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteLearnerAccount(userId);
      if (!result.success) {
        setError(result.message ?? "Suppression impossible.");
        return;
      }
      router.push("/admin/utilisateurs");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-red-900 dark:text-red-200">
          Supprimer définitivement le compte et toutes ses données
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          Supprimer définitivement
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          aria-hidden
        />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">
            Cette suppression est irréversible.
          </p>
          <p className="text-muted-foreground">
            Seront effacés avec le compte : {enrollmentsCount} inscription
            {enrollmentsCount > 1 ? "s" : ""}, {certificatesCount} certificat
            {certificatesCount > 1 ? "s" : ""}, la progression, les tentatives de
            quiz, les notes et les questions posées. Aucune restauration n&apos;est
            possible.
          </p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <label
          htmlFor="confirm-delete-email"
          className="text-xs font-medium text-foreground"
        >
          Pour confirmer, saisissez <code className="font-mono">{email}</code>
        </label>
        <Input
          id="confirm-delete-email"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          disabled={pending}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
        >
          Annuler
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={!matches || pending}
          onClick={handleDelete}
        >
          {pending ? "Suppression…" : "Supprimer définitivement"}
        </Button>
      </div>
    </div>
  );
}
