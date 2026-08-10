"use client";

import type { UserRole } from "@/generated/prisma/enums";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { HeaderSearch } from "@/components/features/courses/header-search";
import { ThemeToggle } from "@/components/features/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileMenuProps {
  isLoggedIn: boolean;
  /** Rôle issu de la session. Typé sur l'enum Prisma et non sur une liste
   *  figée : une union recopiée diverge au premier rôle ajouté. */
  role?: UserRole;
}

export function MobileMenu({ isLoggedIn, role }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  // Lock du scroll en arrière-plan + fermeture au clavier.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted active:bg-muted lg:hidden"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        aria-controls="mobile-menu-drawer"
      >
        <Menu className="h-6 w-6" aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <aside
            id="mobile-menu-drawer"
            className="absolute right-0 top-0 flex h-full w-full max-w-xs flex-col bg-background shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-4">
                <HeaderSearch />
              </div>

              <nav
                aria-label="Navigation mobile"
                className="flex flex-col gap-1 text-sm font-medium"
              >
                <DrawerLink
                  href="/cours"
                  active={pathname.startsWith("/cours")}
                  onClick={close}
                >
                  Catalogue
                </DrawerLink>
                <DrawerLink
                  href="/categories"
                  active={pathname.startsWith("/categories")}
                  onClick={close}
                >
                  Catégories
                </DrawerLink>
                {isLoggedIn ? (
                  <DrawerLink
                    href="/apprentissage"
                    active={pathname.startsWith("/apprentissage")}
                    onClick={close}
                  >
                    Mon apprentissage
                  </DrawerLink>
                ) : (
                  <DrawerLink
                    href="/devenir-formateur"
                    active={pathname.startsWith("/devenir-formateur")}
                    onClick={close}
                  >
                    Devenir formateur
                  </DrawerLink>
                )}
                {isLoggedIn ? (
                  <>
                    <DrawerLink
                      href="/wishlist"
                      active={pathname === "/wishlist"}
                      onClick={close}
                    >
                      Wishlist
                    </DrawerLink>
                    <DrawerLink
                      href="/panier"
                      active={pathname === "/panier"}
                      onClick={close}
                    >
                      Panier
                    </DrawerLink>
                    <DrawerLink
                      href="/profil"
                      active={pathname === "/profil"}
                      onClick={close}
                    >
                      Profil
                    </DrawerLink>
                    {(role === "INSTRUCTOR" || role === "ADMIN") && (
                      <DrawerLink
                        href="/formateur"
                        active={pathname.startsWith("/formateur")}
                        onClick={close}
                      >
                        Espace formateur
                      </DrawerLink>
                    )}
                    {role &&
                      ["ADMIN", "MODERATOR", "SUPPORT", "FINANCE"].includes(role) && (
                        <DrawerLink
                          href="/admin"
                          active={pathname.startsWith("/admin")}
                          onClick={close}
                        >
                          Administration
                        </DrawerLink>
                      )}
                  </>
                ) : null}
              </nav>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-sm font-medium text-foreground">Apparence</span>
                <ThemeToggle />
              </div>
            </div>

            {!isLoggedIn ? (
              <div className="border-t border-border px-4 py-4">
                <div className="flex flex-col gap-2">
                  <Button asChild variant="outline">
                    <Link href="/connexion" onClick={close}>
                      Connexion
                    </Link>
                  </Button>
                  <Button
                    asChild
                    className="bg-[color:var(--brand-mint)] text-[color:var(--neutral-900)] hover:bg-[color:var(--brand-mint-deep)]"
                  >
                    <Link href="/inscription" onClick={close}>
                      S&apos;inscrire
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function DrawerLink({
  href,
  active,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-2 transition-colors",
        active
          ? "bg-muted text-[color:var(--brand-violet-deep)]"
          : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
