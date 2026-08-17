"use client";

// Feed temps réel des dernières activités de la plateforme.
// Polling toutes les 15s sur /api/admin/live-feed. Pulse animation sur les
// nouveaux items pour signaler visuellement. Stop le polling si l'onglet
// devient invisible (économise la batterie / coût serveur).

import { Activity, Pause, Play } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 15_000;

interface FeedItem {
  kind: "signup" | "order";
  id: string;
  at: string;
  title: string;
  subtitle: string;
}

export function LiveActivityFeed() {
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [lastFetch, setLastFetch] = React.useState<Date | null>(null);
  const [paused, setPaused] = React.useState(false);
  const [newIds, setNewIds] = React.useState<Set<string>>(new Set());
  const knownIds = React.useRef<Set<string>>(new Set());

  const fetchFeed = React.useCallback(async () => {
    try {
      const r = await fetch("/api/admin/live-feed", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { items: FeedItem[] };
      const fresh = new Set<string>();
      for (const it of data.items) {
        if (!knownIds.current.has(it.id)) fresh.add(it.id);
        knownIds.current.add(it.id);
      }
      setItems(data.items);
      setLastFetch(new Date());
      if (fresh.size > 0) {
        setNewIds(fresh);
        // Retire la pulse après 5s
        window.setTimeout(() => setNewIds(new Set()), 5000);
      }
    } catch {
      /* ignore — réessaiera au prochain tick */
    }
  }, []);

  React.useEffect(() => {
    // Premier fetch immédiat (sans marquer "nouveaux" puisque c'est le seed)
    void (async () => {
      const r = await fetch("/api/admin/live-feed", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { items: FeedItem[] };
      for (const it of data.items) knownIds.current.add(it.id);
      setItems(data.items);
      setLastFetch(new Date());
    })();
  }, []);

  React.useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      // Pause si l'onglet est caché — économise les calls
      if (document.visibilityState !== "visible") return;
      void fetchFeed();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchFeed, paused]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="relative inline-flex">
              <Activity
                className={cn(
                  "h-5 w-5",
                  paused ? "text-muted-foreground" : "text-[color:var(--brand-success)]",
                )}
                aria-hidden
              />
              {!paused ? (
                <span
                  aria-hidden
                  className="absolute right-0 top-0 h-2 w-2 animate-ping rounded-full bg-[color:var(--brand-success)]"
                />
              ) : null}
            </span>
            Live — Activité plateforme
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {paused
              ? "Polling en pause"
              : `Auto-refresh toutes les ${POLL_INTERVAL_MS / 1000}s`}
            {lastFetch ? ` · dernière maj : ${formatTime(lastFetch)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={paused ? "Reprendre" : "Mettre en pause"}
        >
          {paused ? (
            <>
              <Play className="h-3 w-3" aria-hidden /> Reprendre
            </>
          ) : (
            <>
              <Pause className="h-3 w-3" aria-hidden /> Pause
            </>
          )}
        </button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas d&apos;activité récente.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((it) => {
              const isFresh = newIds.has(it.id);
              return (
                <li
                  key={it.id}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                    isFresh && "animate-pulse bg-[color:var(--brand-success)]/10",
                  )}
                >
                  {it.kind === "signup" ? (
                    <StatusBadge tone="info">Inscription</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Inscription cours</StatusBadge>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {it.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {it.subtitle}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={it.at}
                  >
                    {formatRelative(new Date(it.at))}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}
