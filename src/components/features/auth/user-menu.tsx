"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { logout } from "@/server/actions/auth";

interface UserMenuProps {
  user: {
    name?: string | null;
    email: string;
    image?: string | null;
    role: string;
  };
  /**
   * Affiche le nom et le rôle à côté de l'avatar (≥ lg).
   *
   * Réservé au CRM : sur le site public, la barre du haut est déjà chargée et
   * l'avatar seul suffit.
   */
  showIdentity?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Élève",
  INSTRUCTOR: "Formateur",
  ADMIN: "Administrateur",
  MODERATOR: "Modération",
  SUPPORT: "Support",
  FINANCE: "Finance",
};

const ROLE_DASHBOARD: Record<string, { href: string; label: string }> = {
  STUDENT: { href: "/apprentissage", label: "Mon apprentissage" },
  INSTRUCTOR: { href: "/formateur", label: "Espace formateur" },
  ADMIN: { href: "/admin", label: "Tableau de bord admin" },
};

export function UserMenu({ user, showIdentity = false }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  const initials =
    user.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2) ?? user.email[0].toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex items-center gap-2 rounded-full border border-transparent p-1 transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          showIdentity && "lg:pr-2.5",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu utilisateur"
      >
        <Avatar src={user.image} alt={user.name ?? user.email} fallback={initials} size={36} />
        {showIdentity ? (
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block max-w-[10rem] truncate text-sm font-semibold leading-tight">
              {user.name ?? user.email}
            </span>
            <span className="block text-xs leading-tight opacity-70">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </span>
        ) : null}
        {showIdentity ? (
          <ChevronDown className="hidden h-4 w-4 shrink-0 opacity-60 lg:block" aria-hidden />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-card p-2 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>

          <div className="my-1 h-px bg-border" />

          {ROLE_DASHBOARD[user.role] ? (
            <Link
              href={ROLE_DASHBOARD[user.role].href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {ROLE_DASHBOARD[user.role].label}
            </Link>
          ) : null}

          {user.role === "ADMIN" ? (
            <Link
              href="/formateur"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              Espace formateur
            </Link>
          ) : null}

          <Link
            href="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            Mon profil
          </Link>

          <div className="my-1 h-px bg-border" />

          <form
            action={async () => {
              await logout();
            }}
          >
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
