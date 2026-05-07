// Endpoint léger pour l'autocomplete du header.
// Renvoie jusqu'à 5 cours rankés par ts_rank_cd. Pas d'auth requis : la
// recherche du catalogue est publique.

import { NextResponse } from "next/server";

import { suggestCourses } from "@/server/queries/courses";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const items = await suggestCourses(q, 5);
  return NextResponse.json({ items });
}
