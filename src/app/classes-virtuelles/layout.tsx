/**
 * Passe-plat volontaire.
 *
 * La coque de compte (menu latéral + en-tête) est montée PAR CHAQUE PAGE et
 * non ici : la salle de classe a besoin de toute la largeur disponible, et un
 * layout de segment s'applique à toutes ses sous-routes sans possibilité de
 * s'y soustraire. Les pages de consultation appellent `AccountShell`, la salle
 * s'en passe.
 */
export default function VirtualClassesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
