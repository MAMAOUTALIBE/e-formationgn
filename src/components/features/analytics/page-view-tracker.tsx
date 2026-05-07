"use client";

// Tracker page-view léger — envoyé en fire-and-forget vers /api/track.
// On évite de tracker les routes admin/formateur (espaces privés) et les
// API. Le sessionId est régénéré toutes les 4 heures (sessionStorage).

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const SESSION_KEY = "efgn_session";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

const SKIP_PREFIXES = [
  "/admin",
  "/formateur",
  "/api",
  "/_next",
  "/profil",
  "/notifications",
  "/wishlist",
  "/panier",
  "/apprentissage",
];

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; exp: number };
      if (parsed.exp > Date.now()) return parsed.id;
    }
  } catch {
    /* ignore */
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  try {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id, exp: Date.now() + SESSION_TTL_MS }),
    );
  } catch {
    /* ignore */
  }
  return id;
}

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;

    const sessionId = getSessionId();
    const referrer =
      typeof document !== "undefined" && document.referrer ? document.referrer : undefined;

    const payload = {
      path: pathname,
      sessionId,
      referrer,
      utmSource: searchParams.get("utm_source") ?? undefined,
      utmMedium: searchParams.get("utm_medium") ?? undefined,
      utmCampaign: searchParams.get("utm_campaign") ?? undefined,
    };

    // Best effort, fire and forget.
    if ("sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/track", blob);
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        /* silence */
      });
    }
  }, [pathname, searchParams]);

  return null;
}
