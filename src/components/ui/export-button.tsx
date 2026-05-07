"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  /** Server Action qui retourne `{ csv, filename }` après vérification des permissions. */
  action: () => Promise<{ csv: string; filename: string } | { error: string }>;
  label?: string;
}

export function ExportButton({ action, label = "Exporter CSV" }: ExportButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'export.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={pending}
        className="gap-2"
      >
        <Download className="h-4 w-4" aria-hidden />
        {pending ? "Préparation…" : label}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
