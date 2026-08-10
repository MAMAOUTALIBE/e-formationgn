"use client";

// Toggle clair/sombre/auto. Utilisé dans les headers et menus mobiles du site
// public comme des espaces de travail.
// Gating "mounted" indispensable : `useTheme()` retourne `undefined` côté
// serveur (pas d'accès à localStorage), puis la vraie valeur après mount.
// Sans gate, les `aria-checked` divergent entre SSR et client → hydration
// error visible en dev. On rend un skeleton stable avant mount.

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useMounted } from "@/lib/hooks/use-persistent-state";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  // Skeleton placeholder même structure (anti layout shift) mais sans
  // aria-checked dynamique. Devient interactif au mount client.
  if (!mounted) {
    return (
      <div
        aria-hidden
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 opacity-60",
          className,
        )}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground">
          <Sun className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground">
          <Monitor className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground">
          <Moon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    );
  }

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
