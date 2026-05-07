"use client";

// Wrappers form/button qui consomment une Server Action retournant
// `ActionResult` (cf. src/server/actions/auth.ts) et affichent un toast
// Sonner sur succès ou erreur. Permet de garder les Server Actions inline
// tout en offrant un feedback visuel cohérent.

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface ActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

const initialState: ActionResult = { success: false };

interface ToastFormProps {
  action: (
    prev: ActionResult,
    formData: FormData,
  ) => Promise<ActionResult>;
  successMessage?: string;
  children: React.ReactNode;
  className?: string;
  /** Reset le formulaire après succès. */
  resetOnSuccess?: boolean;
}

export function ToastForm({
  action,
  successMessage,
  children,
  className,
  resetOnSuccess,
}: ToastFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(state.message ?? successMessage ?? "Action effectuée");
    } else if (state.message) {
      toast.error(state.message);
    } else if (state.fieldErrors) {
      const first = Object.values(state.fieldErrors).flat().filter(Boolean)[0];
      if (first) toast.error(first as string);
    }
  }, [state, successMessage]);

  return (
    <form
      action={formAction}
      className={className}
      // resetOnSuccess : Sonner notifie déjà l'utilisateur.
      // On ne reset pas via state pour rester compatible avec les forms uncontrolled.
      // Le caller peut wrapper avec un key={...} si besoin.
      data-reset={resetOnSuccess ? "true" : undefined}
    >
      {children}
    </form>
  );
}

interface ToastButtonProps {
  /** Server Action sans formData (just-id-style). */
  action: () => Promise<ActionResult>;
  label: string;
  successMessage?: string;
  size?: "sm" | "lg" | "icon";
  variant?: "outline" | "ghost" | "link" | "default";
  className?: string;
  disabled?: boolean;
  /** Demande une confirmation avant d'exécuter. */
  confirm?: string;
}

export function ToastButton({
  action,
  label,
  successMessage,
  size = "sm",
  variant,
  className,
  disabled,
  confirm,
}: ToastButtonProps) {
  async function handleClick() {
    if (confirm && !window.confirm(confirm)) return;
    const id = toast.loading("Traitement…");
    try {
      const result = await action();
      toast.dismiss(id);
      if (result.success) {
        toast.success(result.message ?? successMessage ?? "OK");
      } else {
        toast.error(result.message ?? "Échec.");
      }
    } catch (error) {
      toast.dismiss(id);
      toast.error(error instanceof Error ? error.message : "Erreur réseau.");
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      size={size}
      variant={variant}
      className={className}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}
