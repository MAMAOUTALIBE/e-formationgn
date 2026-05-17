"use client";

// Input « Appliquer un code promo » sur la page cours détail.
// Valide le code via une server action — si OK, affiche le nouveau prix
// + montant économisé ET stocke le code en sessionStorage (clé
// `gandal:promo-code`) pour que le panier le pré-remplisse automatiquement.

import { Loader2, Tag, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { previewCoursePromo } from "@/server/actions/preview-promo";
import type { Currency } from "@/generated/prisma/enums";

const STORAGE_KEY = "gandal:promo-code";

interface CourseCouponInputProps {
  courseId: string;
  currency: Currency;
}

interface AppliedState {
  code: string;
  discountFormatted: string;
  finalPriceFormatted: string;
}

export function CourseCouponInput({ courseId, currency }: CourseCouponInputProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [applied, setApplied] = useState<AppliedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApply() {
    setError(null);
    const code = value.trim();
    if (code.length === 0) return;
    startTransition(async () => {
      const result = await previewCoursePromo({ courseId, code, currency });
      if (!result.ok || !result.code) {
        setError(result.message);
        setApplied(null);
        return;
      }
      setApplied({
        code: result.code,
        discountFormatted: result.discountFormatted ?? "",
        finalPriceFormatted: result.finalPriceFormatted ?? "",
      });
      try {
        window.sessionStorage.setItem(STORAGE_KEY, result.code);
      } catch {
        /* sessionStorage indisponible → on continue silencieusement */
      }
    });
  }

  function handleRemove() {
    setApplied(null);
    setValue("");
    setError(null);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* idem */
    }
  }

  if (!open && !applied) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--brand-secondary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Tag className="h-3.5 w-3.5" aria-hidden />
        J&apos;ai un code promo
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="coupon-input" className="text-xs font-medium text-foreground">
        Code promo
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="EX : BIENVENUE10"
          disabled={pending || applied !== null}
          autoComplete="off"
          className="font-mono uppercase"
        />
        {applied ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            aria-label="Retirer le code"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            disabled={pending || value.trim().length === 0}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Valider"}
          </Button>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-[color:var(--brand-danger)]">
          {error}
        </p>
      ) : null}

      {applied ? (
        <div className="rounded-md border border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/10 p-3 text-xs text-foreground">
          <p>
            <span className="font-semibold">Code « {applied.code} » appliqué.</span>{" "}
            Vous économisez <strong>{applied.discountFormatted}</strong> —
            nouveau prix : <strong>{applied.finalPriceFormatted}</strong>.
          </p>
          <p className="mt-1 text-muted-foreground">
            Le code sera automatiquement reporté à votre panier.
          </p>
        </div>
      ) : null}
    </div>
  );
}
