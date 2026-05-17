import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// Route OG image dynamique 1200×630 (ratio 1.91:1 — Twitter/LinkedIn/Facebook).
// Usage : /api/og?title=Mon%20cours&subtitle=...&kind=course
// Tous les params sont optionnels — sans paramètre, on rend la card "site".
//
// Note Next 16 : `ImageResponse` se rend en edge runtime (Satori). Pas de
// dépendance Node — tout le HTML/CSS est inlined. Les polices sont chargées
// dynamiquement depuis Google Fonts au premier appel (cache CDN par la suite).

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };

const PALETTE = {
  primary: "#1E3A8A", // brand-primary
  violet: "#7C3AED", // brand-violet
  violetDeep: "#5B21B6", // brand-violet-deep
  mint: "#92F6A1", // brand-mint
  white: "#FFFFFF",
  textDim: "rgba(255,255,255,0.78)",
};

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const kind = params.get("kind") ?? "site"; // "site" | "course"
  const title = (params.get("title") ?? "Gandal").slice(0, 120);
  const subtitle = (params.get("subtitle") ?? "Apprendre. Enseigner. Progresser.").slice(0, 160);
  const rating = params.get("rating");
  const totalRatings = params.get("totalRatings");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          background: `linear-gradient(135deg, ${PALETTE.primary} 0%, ${PALETTE.violetDeep} 55%, ${PALETTE.violet} 100%)`,
          color: PALETTE.white,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Header : logo + kind */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: PALETTE.mint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: PALETTE.primary,
                fontWeight: 900,
                fontSize: 32,
              }}
            >
              G
            </div>
            <span>Gandal</span>
          </div>
          {kind === "course" ? (
            <div
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.12)",
                fontSize: 22,
                fontWeight: 500,
              }}
            >
              Formation en ligne
            </div>
          ) : null}
        </div>

        {/* Corps : titre + sous-titre */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: title.length > 60 ? 60 : 76,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              color: PALETTE.textDim,
              lineHeight: 1.3,
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Footer : URL + rating éventuel */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 24, color: PALETTE.textDim }}>gandal.gn</div>
          {rating && Number(rating) > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              <span style={{ color: PALETTE.mint }}>★</span>
              <span>{Number(rating).toFixed(1)}</span>
              {totalRatings ? (
                <span style={{ color: PALETTE.textDim, fontWeight: 400 }}>
                  ({Number(totalRatings).toLocaleString("fr-FR")} avis)
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        // Cache CDN : on accepte un peu de staleness pour absorber les
        // explosions de partage social. Reset toutes les heures.
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}
