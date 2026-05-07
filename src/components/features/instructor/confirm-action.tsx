"use client";

// Bouton qui demande confirmation avant d'exécuter une Server Action.
// On utilise window.confirm pour rester simple et accessible. Une dialog
// Radix pourra remplacer ça en Phase 8 si besoin.

import { useTransition } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

interface ConfirmActionProps extends Omit<ButtonProps, "onClick" | "type"> {
  message: string;
  onConfirm: () => Promise<unknown>;
  children: React.ReactNode;
  pendingLabel?: string;
}

export function ConfirmAction({
  message,
  onConfirm,
  children,
  pendingLabel = "Traitement…",
  disabled,
  ...rest
}: ConfirmActionProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (typeof window !== "undefined" && !window.confirm(message)) {
      return;
    }
    startTransition(async () => {
      await onConfirm();
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || pending}
      {...rest}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
