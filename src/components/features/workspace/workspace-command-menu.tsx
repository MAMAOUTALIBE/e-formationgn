"use client";

// Recherche globale d'un espace (⌘K) : navigation rapide vers ses écrans, et
// — quand l'espace en expose un — résultats métier renvoyés par un point
// d'API dédié.
//
// Les écrans proposés viennent de la navigation déjà filtrée pour le rôle :
// la recherche ne peut donc jamais mener à un écran que le menu masque.

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { ResolvedWorkspaceNav } from "@/lib/workspace/navigation";

/** Compare sans tenir compte des accents ni de la casse : « securite » doit
 *  trouver « Sécurité », sinon la recherche est inutilisable en français. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

interface SearchHit {
  type: "user" | "course" | "order" | "ticket";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const TYPE_LABEL: Record<SearchHit["type"], string> = {
  user: "Utilisateur",
  course: "Cours",
  order: "Commande",
  ticket: "Ticket",
};

interface WorkspaceCommandMenuProps {
  nav: ResolvedWorkspaceNav;
  /**
   * Point d'API de recherche métier (`?q=`). Absent = recherche d'écrans
   * seulement — c'est le cas des espaces qui n'ont pas d'index dédié.
   */
  searchEndpoint?: string;
  placeholder: string;
}

export function WorkspaceCommandMenu({
  nav,
  searchEndpoint,
  placeholder,
}: WorkspaceCommandMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!open || !searchEndpoint) return;
    const term = query.trim();
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${searchEndpoint}?q=${encodeURIComponent(term)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits);
      } catch {
        /* silence */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, searchEndpoint]);

  const visibleHits = searchEndpoint && query.trim().length >= 2 ? hits : [];

  const matchingPages = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return nav.pages
      .filter((p) => normalize(p.label).includes(q) || normalize(p.href).includes(q))
      .slice(0, 8);
  }, [query, nav.pages]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      {/* Faux champ de saisie : c'est un bouton (il ouvre une palette), mais
          il en a l'apparence pour être identifié comme la recherche de
          l'espace au lieu d'un bouton de plus dans la barre du haut. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Rechercher"
        aria-keyshortcuts="Meta+K Control+K"
        className="group flex h-11 w-11 items-center justify-center gap-2.5 rounded-full border border-border bg-muted/50 p-0 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-muted sm:h-auto sm:w-full sm:justify-start sm:px-3.5 sm:py-2.5"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        {/* Deux libellés plutôt qu'un masqué : sur mobile, cacher le texte
            laissait une barre vide sur toute la largeur. */}
        <span className="sr-only sm:not-sr-only sm:flex-1 sm:truncate">{placeholder}</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-start sm:p-4 sm:pt-[10dvh]"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <Command
            label="Recherche"
            className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden border border-border bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-2xl sm:h-auto sm:max-h-[80dvh] sm:max-w-xl sm:rounded-lg sm:p-0"
            shouldFilter={false}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={placeholder}
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto py-2 sm:max-h-[400px]">
              <Command.Empty className="px-4 py-6 text-center text-sm text-muted-foreground">
                {loading
                  ? "Recherche…"
                  : query.length < 2
                    ? "Tapez au moins 2 caractères pour chercher."
                    : "Aucun résultat."}
              </Command.Empty>

              {query.length < 2 ? (
                <Command.Group
                  heading="Navigation rapide"
                  className="px-2 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
                >
                  {nav.pinned.concat(nav.groups.flatMap((g) => g.sections)).map((s) => (
                    <Command.Item
                      key={s.href}
                      value={s.href}
                      onSelect={() => go(s.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-muted"
                    >
                      {s.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {matchingPages.length > 0 ? (
                <Command.Group
                  heading="Écrans"
                  className="px-2 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
                >
                  {matchingPages.map((page) => (
                    <Command.Item
                      key={page.href}
                      value={page.href}
                      onSelect={() => go(page.href)}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-muted"
                    >
                      <span>{page.label}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {page.href}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {visibleHits.length > 0 ? (
                <Command.Group
                  heading="Résultats"
                  className="px-2 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
                >
                  {visibleHits.map((hit) => (
                    <Command.Item
                      key={`${hit.type}-${hit.id}`}
                      onSelect={() => go(hit.href)}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {TYPE_LABEL[hit.type]}
                        </span>
                        <span className="truncate font-medium">{hit.title}</span>
                      </span>
                      {hit.subtitle ? (
                        <span className="text-xs text-muted-foreground">{hit.subtitle}</span>
                      ) : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </div>
      ) : null}
    </>
  );
}
