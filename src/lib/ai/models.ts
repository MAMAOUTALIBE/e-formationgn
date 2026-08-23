// Identifiants des modèles Claude, déclarés une seule fois.
//
// Les cinq assistants pointaient chacun vers un identifiant écrit à la main,
// issus de quatre générations différentes (`claude-opus-5`,
// `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-haiku-4-5-20251001`). Deux
// d'entre eux ne relevaient plus de la génération courante : la mise à jour
// d'un modèle supposait de retrouver tous les points d'appel, et un identifiant
// périmé n'échoue qu'au moment de l'appel, en production.
//
// Le choix du palier reste délibéré et documenté ci-dessous : c'est le rapport
// coût / qualité attendu qui le dicte, pas la disponibilité du moment.

/** Raisonnement long, sujets ouverts, accompagnement pédagogique. */
export const MODEL_OPUS = "claude-opus-5";

/** Rédaction et structuration : le palier par défaut pour l'écrit. */
export const MODEL_SONNET = "claude-sonnet-5";

/** Classification courte et volumineuse : modération, tri, étiquetage. */
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
