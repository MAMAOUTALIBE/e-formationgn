"use client";

// Toggle clair/sombre/auto. Utilisé dans le UserMenu et l'header admin.
// Pas de gating "mounted" — next-themes injecte la classe sur <html> côté
// serveur via le ThemeProvider, donc l'état initial des boutons matche déjà
// le DOM. `suppressHydrationWarning` sur <html> couvre les variations.

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Thème de l'interface"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5",
        className,
      )}
    >
      <ThemeButton
        value="light"
        active={theme === "light"}
        onClick={() => setTheme("light")}
        icon={<Sun className="h-3.5 w-3.5" aria-hidden />}
        label="Clair"
      />
      <ThemeButton
        value="system"
        active={theme === "system" || !theme}
        onClick={() => setTheme("system")}
        icon={<Monitor className="h-3.5 w-3.5" aria-hidden />}
        label="Auto"
      />
      <ThemeButton
        value="dark"
        active={theme === "dark"}
        onClick={() => setTheme("dark")}
        icon={<Moon className="h-3.5 w-3.5" aria-hidden />}
        label="Sombre"
      />
    </div>
  );
}

function ThemeButton({
  value,
  active,
  onClick,
  icon,
  label,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={`Thème ${label}`}
      title={label}
      onClick={onClick}
      data-value={value}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors",
        active
          ? "bg-[color:var(--brand-primary)] text-primary-foreground"
          : "hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
