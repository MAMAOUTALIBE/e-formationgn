import "server-only";

// Pricing engine — barrel d'export des opérations de calcul tarifaire.
//
// Regroupe en un seul module :
//   - calcul des lignes de panier (prix unitaire, remises, totaux)
//   - application d'un code promo (lecture DB + règles métier)
//   - calcul de la commission plateforme/formateur sur une vente
//
// Le contenu vit historiquement dans queries/cart.ts (cart math) et
// lib/commission.ts (commissions). On centralise ici l'API publique pour
// que les futures features (admin pricing, simulateurs) aient une surface
// d'import unique. Les implémentations restent là où elles sont — on ne
// déplace que l'usage.

export {
  computeCartLines,
  tryApplyPromo,
  type AppliedPromo,
} from "@/server/queries/cart";

export {
  computeCommission,
  DEFAULT_COMMISSION_RATES,
} from "@/lib/commission";
