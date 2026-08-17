// FAQ statique affichée en bas de la page cours détail.
// Pattern Udemy : couvre les questions récurrentes (accès, remboursement,
// certificat, support) → réduit les hésitations avant achat ET diminue
// le volume de tickets support.
//
// Le contenu est figé côté serveur pour l'instant (pas de CMS dédié) — à
// migrer vers `CmsPage` ou un modèle `CourseFaq` si on veut le rendre
// éditable par cours plus tard.

import { ChevronDown } from "lucide-react";

interface CourseFaqProps {
  /** Inclut une question dynamique sur la garantie remboursement. */
  showMoneyBackQuestion?: boolean;
  /** Inclut une question sur les certificats — utile pour les cours avec
   *  délivrance de certificat (cas par défaut chez Gandal). */
  showCertificateQuestion?: boolean;
}

interface FaqItem {
  q: string;
  a: string;
}

export function CourseFaq(props: CourseFaqProps = {}) {
  const { showCertificateQuestion = true } = props;
  const items: FaqItem[] = [
    {
      q: "Quand puis-je commencer le cours ?",
      a: "Dès que votre gestionnaire vous inscrit, le cours apparaît dans « Mon apprentissage ».",
    },
    {
      q: "Combien de temps ai-je accès au cours ?",
      a: "La durée d'accès dépend de la session organisée par votre société. Les dates sont indiquées dans votre espace d'apprentissage.",
    },
    ...(showCertificateQuestion
      ? [
          {
            q: "Vais-je recevoir un certificat ?",
            a: "Oui. Dès que vous avez complété 100 % des leçons, un certificat nominatif vérifiable en ligne est généré dans votre profil — téléchargeable en PDF.",
          },
        ]
      : []),
    {
      q: "Puis-je suivre le cours sur mobile ?",
      a: "Oui. Le site est responsive et fonctionne sur smartphone, tablette et ordinateur. Vous pouvez reprendre la lecture exactement où vous l'avez laissée d'un appareil à l'autre.",
    },
    {
      q: "Comment poser une question au formateur ?",
      a: "Chaque cours dispose d'un espace « Q & R » où vous pouvez poser vos questions au formateur. Vous trouverez aussi un tuteur IA contextuel sur chaque leçon pour une aide immédiate.",
    },
  ];

  return (
    <section aria-labelledby="faq">
      <h2 id="faq" className="text-xl font-semibold text-foreground">
        Questions fréquentes
      </h2>
      <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((item, index) => (
          <li key={index}>
            {/* <details> natif pour rester accessible sans JS — Udemy fait
                pareil. Le chevron tourne via group-open. */}
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                <span className="text-sm font-medium text-foreground">{item.q}</span>
                <ChevronDown
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="border-t border-border bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
                {item.a}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
