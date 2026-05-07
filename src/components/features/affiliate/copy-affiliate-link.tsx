"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyAffiliateLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard refusé — pas de fallback agressif */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-[color:var(--brand-success)]" aria-hidden />
          Copié
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          Copier
        </>
      )}
    </button>
  );
}
