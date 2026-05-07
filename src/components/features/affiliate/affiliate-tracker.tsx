"use client";

// Composant invisible posé dans le RootLayout. À chaque navigation, si la
// query string contient `?ref=<code>`, on appelle la Server Action qui
// vérifie l'existence du code et pose le cookie.

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { trackAffiliateRef } from "@/server/actions/affiliate";

export function AffiliateTracker() {
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("ref");
    if (!code) return;
    void trackAffiliateRef(code);
  }, [params]);

  return null;
}
