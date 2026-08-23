import * as React from "react";

import { cn } from "@/lib/utils";

import { Label } from "./label";

// Helper de lecture des erreurs Zod-flattened renvoyées par les Server Actions
// (`ActionResult.fieldErrors`). Évite la répétition `state.fieldErrors?.foo?.[0]`
// dans chaque formulaire `useActionState`.
export function getFieldError(
  fieldErrors: Record<string, string[] | undefined> | undefined,
  field: string,
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

interface FormFieldProps {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  // Le message d'erreur était bien affiché, mais rien ne le rattachait au
  // champ : un lecteur d'écran annonçait l'erreur en arrivant dessus, sans
  // qu'on sache lequel des champs elle concernait, et le champ fautif n'était
  // signalé ni visuellement ni par `aria-invalid` (RGAA 11.10, WCAG 3.3.1).
  //
  // On injecte donc les deux attributs sur le contrôle enfant, une fois pour
  // toutes : chaque formulaire bâti sur ce composant en bénéficie sans avoir à
  // y penser. Les attributs déjà posés par l'appelant l'emportent.
  const messageId = error ? `${id}-erreur` : hint ? `${id}-aide` : undefined;
  const controle = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        "aria-invalid":
          (children.props as Record<string, unknown>)["aria-invalid"] ??
          (error ? true : undefined),
        "aria-describedby":
          (children.props as Record<string, unknown>)["aria-describedby"] ?? messageId,
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {controle}
      {error ? (
        <p id={messageId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
