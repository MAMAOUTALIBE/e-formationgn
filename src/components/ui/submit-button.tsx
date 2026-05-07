"use client";

import { useFormStatus } from "react-dom";
import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

interface SubmitButtonProps extends Omit<ButtonProps, "type"> {
  pendingLabel?: string;
  children: React.ReactNode;
}

/**
 * Bouton de soumission qui exploite useFormStatus pour gérer automatiquement
 * l'état "en cours". À placer à l'intérieur d'un <form action={…}>.
 */
export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} {...rest}>
      {pending ? (pendingLabel ?? "Enregistrement…") : children}
    </Button>
  );
}
