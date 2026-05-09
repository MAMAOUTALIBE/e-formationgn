// Endpoint léger pour l'autocomplete du header.
// Renvoie jusqu'à 5 cours rankés par ts_rank_cd. Pas d'auth requis : la
// recherche du catalogue est publique. Rate-limit IP-based pour éviter
// le scraping massif du catalogue.

import { NextResponse } from "next/server";

import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { suggestCourses } from "@/server/queries/courses";

const PRIVATE_NO_STORE = "private, no-store, max-age=0";

export async function GET(request: Request) {
  const rl = checkRateLimit({
    key: clientKey(request.headers, "search"),
    windowMs: 60_000,
    max: 60,
  });
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Cache-Control": PRIVATE_NO_STORE,
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  // Rejette les requêtes excessives en longueur (vague de fuzzing/inputs)
  if (q.length > 200) {
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": PRIVATE_NO_STORE } });
  }

  const items = await suggestCourses(q, 5);
  return NextResponse.json(
    { items },
    {
      headers: {
        // Suggestions personnalisables par catalogue : pas de cache CDN partagé.
        "Cache-Control": "public, max-age=10, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
