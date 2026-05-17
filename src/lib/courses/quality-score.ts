// Score qualité 0-100 par cours — combine note + popularité, pondéré.
// Permet de repérer rapidement les cours top et ceux qui décrochent.
//
// Formule :
//   ratingPart    = (averageRating / 5) × 60   [rating pèse le plus, 60%]
//   popularityPart = min(40, ln(enrollments+1) × 8)  [popularité capée]
//
// Bonus possible plus tard : taux de complétion (LessonProgress), nombre de
// Q&A actives, nombre d'avis avec commentaire. Pour V1, on garde simple.

export interface QualityScoreInput {
  averageRating: number;
  totalEnrollments: number;
  totalRatings: number;
}

export interface QualityScoreResult {
  score: number; // 0-100
  tier: "excellent" | "bon" | "moyen" | "faible" | "indéfini";
  reason: string;
}

export function computeQualityScore(input: QualityScoreInput): QualityScoreResult {
  const { averageRating, totalEnrollments, totalRatings } = input;

  // Pas assez de signal pour scorer : moins de 3 avis OU 0 inscription.
  if (totalRatings < 3 || totalEnrollments === 0) {
    return {
      score: 0,
      tier: "indéfini",
      reason: `${totalRatings} avis, ${totalEnrollments} élève${totalEnrollments > 1 ? "s" : ""} — pas assez de signal`,
    };
  }

  const ratingPart = (averageRating / 5) * 60;
  const popularityPart = Math.min(40, Math.log(totalEnrollments + 1) * 8);
  const score = Math.max(0, Math.min(100, Math.round(ratingPart + popularityPart)));

  let tier: QualityScoreResult["tier"];
  if (score >= 80) tier = "excellent";
  else if (score >= 60) tier = "bon";
  else if (score >= 40) tier = "moyen";
  else tier = "faible";

  return {
    score,
    tier,
    reason: `${averageRating.toFixed(1)}★ sur ${totalRatings} avis, ${totalEnrollments} élève${totalEnrollments > 1 ? "s" : ""}`,
  };
}

export function qualityTierColor(tier: QualityScoreResult["tier"]): string {
  switch (tier) {
    case "excellent":
      return "bg-[color:var(--brand-success)]/15 text-[color:var(--brand-success)]";
    case "bon":
      return "bg-[color:var(--brand-secondary)]/15 text-[color:var(--brand-secondary)]";
    case "moyen":
      return "bg-[color:var(--brand-warning)]/15 text-[color:var(--brand-warning)]";
    case "faible":
      return "bg-[color:var(--brand-danger)]/15 text-[color:var(--brand-danger)]";
    case "indéfini":
      return "bg-muted text-muted-foreground";
  }
}
