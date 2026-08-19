"use client";

import { useActionState, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AccountStatus } from "@/generated/prisma/enums";
import {
  STAFF_ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/account-audience";
import {
  assignAdminRole,
  createStaffAccount,
  setStaffAccountStatus,
  type CreateStaffAccountResult,
} from "@/server/actions/admin-security";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };
const initialCreateState: CreateStaffAccountResult = { success: false };

export function CreateStaffAccountForm({
  defaultRole = "INSTRUCTOR",
}: {
  defaultRole?: StaffRole;
}) {
  const [state, formAction] = useActionState(createStaffAccount, initialCreateState);
  const values = state.values;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.success && state.temporaryPassword ? (
        <Alert variant="success">
          <AlertDescription>
            <p className="font-medium">Compte créé pour {state.createdEmail}</p>
            <p className="mt-2 text-sm">
              Mot de passe permanent — transmettez-le de manière sécurisée :
            </p>
            <code className="mt-1 block rounded-md bg-background px-3 py-2 font-mono text-base tracking-wide text-foreground">
              {state.temporaryPassword}
            </code>
          </AlertDescription>
        </Alert>
      ) : null}

      {!state.success && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="staff-create-firstName"
          label="Prénom"
          error={errors.firstName?.[0]}
        >
          <Input
            id="staff-create-firstName"
            name="firstName"
            defaultValue={values?.firstName ?? ""}
            required
          />
        </FormField>
        <FormField
          id="staff-create-lastName"
          label="Nom"
          error={errors.lastName?.[0]}
        >
          <Input
            id="staff-create-lastName"
            name="lastName"
            defaultValue={values?.lastName ?? ""}
            required
          />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
        <FormField
          id="staff-create-email"
          label="Email professionnel"
          error={errors.email?.[0]}
        >
          <Input
            id="staff-create-email"
            name="email"
            type="email"
            defaultValue={values?.email ?? ""}
            placeholder="prenom.nom@aiduca.fr"
            required
          />
        </FormField>
        <FormField
          id="staff-create-role"
          label="Rôle interne"
          error={errors.role?.[0]}
        >
          <Select
            id="staff-create-role"
            name="role"
            defaultValue={values?.role ?? defaultRole}
            required
          >
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {STAFF_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <SubmitButton>Créer le compte interne</SubmitButton>
    </form>
  );
}

/** Change le rôle d'un compte déjà interne, sans toucher aux apprenants. */
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

      <div className="grid gap-3 sm:grid-cols-[1fr_190px_auto] sm:items-end">
        <FormField
          id="staff-role-email"
          label="Email du compte interne"
          error={errors.email?.[0]}
        >
          <Input
            id="staff-role-email"
            name="email"
            type="email"
            required
            placeholder="personne@aiduca.fr"
          />
        </FormField>
        <FormField id="staff-role-role" label="Nouveau rôle" error={errors.role?.[0]}>
          <Select id="staff-role-role" name="role" defaultValue="MANAGER" required>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {STAFF_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </FormField>
        <SubmitButton>Modifier</SubmitButton>
      </div>
    </form>
  );
}

export function StaffAccessButton({
  userId,
  email,
  status,
  isSelf,
}: {
  userId: string;
  email: string;
  status: AccountStatus;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = status === "ACTIVE";

  if (isSelf) return <span className="text-xs text-muted-foreground">Vous</span>;

  function run(nextStatus: "ACTIVE" | "SUSPENDED") {
    startTransition(async () => {
      setError(null);
      const result = await setStaffAccountStatus(userId, nextStatus);
      if (!result.success) {
        setError(result.message ?? "Échec.");
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant={active ? "ghost" : "outline"}
        size="sm"
        disabled={pending}
        onClick={() => (active ? setOpen(true) : run("ACTIVE"))}
      >
        {active ? "Désactiver" : "Réactiver"}
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Désactiver ce compte interne ?"
        description={`${email} perdra immédiatement l’accès à son espace, mais ne deviendra pas un apprenant.`}
        confirmLabel="Désactiver"
        destructive
        pending={pending}
        onConfirm={() => run("SUSPENDED")}
      />
    </>
  );
}
