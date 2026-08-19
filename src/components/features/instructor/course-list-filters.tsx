"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "PENDING_REVIEW", label: "En attente" },
  { value: "PUBLISHED", label: "Publié" },
  { value: "REJECTED", label: "Refusé" },
  { value: "ARCHIVED", label: "Archivé" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Récemment modifiés" },
  { value: "title", label: "Titre (A→Z)" },
  { value: "enrollments", label: "Élèves (décroissant)" },
];

/**
 * Barre de filtres de la liste des cours : recherche (debounced), statut et
 * tri. Met à jour les query params de l'URL (la page serveur lit `searchParams`
 * et filtre/trie en conséquence).
 */
export function CourseListFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function pushParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "ALL" && value !== "recent") next.set(key, value);
    else next.delete(key);
    router.push(`/formateur/cours?${next.toString()}`, { scroll: false });
  }

  // Recherche debounced (300 ms) → met à jour ?q
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => pushParam("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une formation…"
          aria-label="Rechercher une formation"
          className="pl-9"
        />
      </div>
      <Select
        aria-label="Filtrer par statut"
        defaultValue={params.get("status") ?? "ALL"}
        onChange={(e) => pushParam("status", e.target.value)}
        className="sm:w-44"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Trier"
        defaultValue={params.get("sort") ?? "recent"}
        onChange={(e) => pushParam("sort", e.target.value)}
        className="sm:w-52"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
