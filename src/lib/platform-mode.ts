// Mode de fonctionnement de la plateforme.
//
// `marketplace` (défaut historique) : catalogue payant, panier, tunnel Stripe /
// CinetPay, commissions et versements formateurs.
//
// `centre_formation` : le centre crée lui-même les comptes (élèves ET
// formateurs) et attribue les formations. Aucune vente à l'unité, donc ni
// prix, ni panier, ni achat affichés — et l'inscription publique est fermée.
//
// Pourquoi un mode plutôt qu'une suppression du code de paiement : retirer
// Stripe/CinetPay imposerait de toucher au tunnel de commande, aux webhooks,
// aux commandes, aux versements et aux commissions — une démolition large et
// risquée sur du code déjà éprouvé, pour aucun gain fonctionnel. Ici le code
// commercial reste en place mais dormant, et le retour en arrière tient dans
// une variable d'environnement.

export type PlatformMode = "centre_formation";

export function getPlatformMode(): PlatformMode {
  return "centre_formation";
}

/**
 * Vrai quand la plateforme sert un centre de formation interne.
 *
 * À utiliser pour masquer l'affichage commercial. Attention : masquer une
 * interface ne protège rien. Les points d'entrée sensibles (inscription
 * publique, tunnel de commande) doivent refuser côté SERVEUR, pas seulement
 * cesser d'afficher un bouton.
 */
export function isTrainingCenterMode(): boolean {
  return getPlatformMode() === "centre_formation";
}
