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

export type PlatformMode = "marketplace" | "centre_formation";

export function getPlatformMode(): PlatformMode {
  // On lit la variable PUBLIQUE en premier, et ce n'est pas un détail.
  //
  // `PLATFORM_MODE` n'existe que sur le serveur. Or un composant serveur
  // importé par un composant client — c'est le cas de `CourseCard`, importé
  // par `CourseResultsArea` — est compilé DANS le paquet navigateur, où cette
  // variable vaut `undefined`. Le serveur concluait donc « centre de
  // formation » et masquait les prix, le navigateur concluait « marketplace »
  // et les réaffichait : React refusait l'hydratation (erreur #418) et les
  // prix apparaissaient malgré tout dans la page.
  //
  // La variable publique, elle, est figée au build dans les DEUX paquets :
  // les deux rendus s'accordent. Le repli sur `PLATFORM_MODE` conserve le
  // comportement des déploiements qui ne la fournissent pas encore.
  const mode =
    process.env.NEXT_PUBLIC_PLATFORM_MODE ?? process.env.PLATFORM_MODE;
  return mode === "centre_formation" ? "centre_formation" : "marketplace";
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
