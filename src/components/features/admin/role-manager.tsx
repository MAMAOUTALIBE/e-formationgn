"use client";

import { useActionState, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { assignAdminRole, revokeAdminRole } from "@/server/actions/admin-security";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

const ASSIGNABLE_ROLES = ["MODERATOR", "SUPPORT", "FINANCE", "ADMIN"] as const;

/** Formulaire : attribuer un rôle administratif à un compte par email. */
export function RoleAssignForm() {
  const [state, formAction] = useActionState(assignAdminRole, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <FormField id="email" label="Email du compte" error={errors.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="personne@exemple.com"
          />
        </FormField>
        <FormField id="role" label="Rôle" error={errors.role?.[0]}>
          <Select id="role" name="role" defaultValue="MODERATOR" required>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </FormField>
        <SubmitButton>Attribuer</SubmitButton>
      </div>
    </form>
  );
}

/** Bouton de révocation d'un rôle (→ STUDENT) avec confirmation. */
export function RevokeRoleButton({
  userId,
  email,
  isSelf,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isSelf) {
    return (
      <span className="text-xs text-muted-foreground">Vous</span>
    );
  }

  function confirm() {
    startTransition(async () => {
      const res = await revokeAdminRole(userId);
      if (!res.success) {
        setError(res.message ?? "Échec.");
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Révoquer
      </Button>
      {error ? (
        <p className="mt-1 text-xs text-[color:var(--brand-danger)]">{error}</p>
      ) : null}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Révoquer le rôle ?"
        description={`${email} repassera au rôle STUDENT et perdra l'accès à l'espace admin.`}
        confirmLabel="Révoquer"
        destructive
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
