"use client";

// Recherche globale admin (Cmd+K). Pour l'instant : navigation rapide vers
// les pages admin + déclenche un search côté serveur via `/api/admin/search`
// quand l'utilisateur tape (debounced 200ms).

import { Command } from "cmdk";
import {
  BarChart3,
  BookOpenText,
  GaugeCircle,
  GraduationCap,
  LifeBuoy,
  Megaphone,
  Search,
  Settings2,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ADMIN_PAGES } from "@/lib/admin/navigation";

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

const QUICK_LINKS: Array<{ icon: React.ReactNode; label: string; href: string }> = [
  { icon: <GaugeCircle className="h-4 w-4" />, label: "Vue d'ensemble", href: "/admin" },
  { icon: <BarChart3 className="h-4 w-4" />, label: "Analytics", href: "/admin/analytics" },
  { icon: <Wallet className="h-4 w-4" />, label: "Finances", href: "/admin/finances" },
  { icon: <Megaphone className="h-4 w-4" />, label: "Marketing", href: "/admin/marketing" },
  { icon: <Users className="h-4 w-4" />, label: "Utilisateurs", href: "/admin/utilisateurs" },
  { icon: <GraduationCap className="h-4 w-4" />, label: "Formateurs", href: "/admin/formateurs" },
  { icon: <LifeBuoy className="h-4 w-4" />, label: "Support", href: "/admin/support" },
  { icon: <BookOpenText className="h-4 w-4" />, label: "Cours", href: "/admin/cours" },
  { icon: <Settings2 className="h-4 w-4" />, label: "Paramètres", href: "/admin/parametres" },
  { icon: <Shield className="h-4 w-4" />, label: "Sécurité", href: "/admin/securite" },
];

export function AdminCommandMenu() {
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
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`);
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
  }, [query, open]);

  const visibleHits = query.trim().length >= 2 ? hits : [];

  // Les 44 pages de l'admin deviennent recherchables. Auparavant la liste de
  // navigation disparaissait dès la première frappe et seuls les résultats
  // serveur (users/cours/commandes/tickets) restaient : taper « payouts » ne
  // menait nulle part.
  const matchingPages = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return ADMIN_PAGES.filter(
      (p) => normalize(p.label).includes(q) || normalize(p.href).includes(q),
    ).slice(0, 8);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground/30"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <Command
            label="Recherche admin"
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
            shouldFilter={false}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Utilisateur, cours, commande, ticket…"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-[400px] overflow-y-auto py-2">
              <Command.Empty className="px-4 py-6 text-center text-sm text-muted-foreground">
                {loading ? "Recherche…" : query.length < 2 ? "Tape au moins 2 caractères pour chercher." : "Aucun résultat."}
              </Command.Empty>

              {query.length < 2 ? (
                <Command.Group heading="Navigation rapide" className="px-2 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
                  {QUICK_LINKS.map((link) => (
                    <Command.Item
                      key={link.href}
                      onSelect={() => go(link.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-muted"
                    >
                      <span className="text-muted-foreground">{link.icon}</span>
                      {link.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {matchingPages.length > 0 ? (
                <Command.Group heading="Pages" className="px-2 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
                  {matchingPages.map((page) => (
                    <Command.Item
                      key={page.href}
                      value={page.href}
                      onSelect={() => go(page.href)}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-muted"
                    >
                      <span>{page.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{page.href}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {visibleHits.length > 0 ? (
                <Command.Group heading="Résultats" className="px-2 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
                  {visibleHits.map((hit) => (
                    <Command.Item
                      key={`${hit.type}-${hit.id}`}
                      onSelect={() => go(hit.href)}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <TypeBadge type={hit.type} />
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

function TypeBadge({ type }: { type: SearchHit["type"] }) {
  const map: Record<SearchHit["type"], string> = {
    user: "Utilisateur",
    course: "Cours",
    order: "Commande",
    ticket: "Ticket",
  };
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {map[type]}
    </span>
  );
}
