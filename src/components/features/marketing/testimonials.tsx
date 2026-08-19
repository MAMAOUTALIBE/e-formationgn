// Témoignages d'élèves — section trust sur la home.
// Contenu statique pour MVP (en attendant un seed d'avis suffisamment
// fournis pour piocher automatiquement). À l'avenir, remplacer par les
// 3 meilleurs `Review` 5★ avec commentaire long, joints à user.image.
//
// Note : les avatars utilisent le composant Avatar qui dégrade joliment
// vers initiales si `image` est null — pas besoin de vraies photos pour le MVP.

import { Quote } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Stars } from "@/components/ui/stars";
import { Container } from "@/components/ui/container";

interface Testimonial {
  name: string;
  role: string;
  rating: number;
  quote: string;
  image?: string | null;
}

// Contenu marketing — à éditer côté équipe contenu, pas dynamique.
const TESTIMONIALS: Testimonial[] = [
  {
    name: "Fatou Camara",
    role: "Développeuse junior · Conakry",
    rating: 5,
    quote:
      "J'ai pu changer de métier en 6 mois grâce à la formation Next.js. Les explications du formateur sont claires, et le tuteur IA m'a énormément aidée à débloquer mes premiers projets.",
  },
  {
    name: "Mamadou Diop",
    role: "Marketing manager · Dakar",
    rating: 5,
    quote:
      "Les formations sont structurées, pratiques, et adaptées au marché africain francophone. Le format vidéo + quiz est idéal pour apprendre le soir après le travail.",
  },
  {
    name: "Aïcha Traoré",
    role: "Designer UI · Abidjan",
    rating: 5,
    quote:
      "Enfin une plateforme francophone de qualité ! L'accès illimité aux formations et le certificat à la fin font vraiment la différence sur mon CV. Je recommande à 100 %.",
  },
];

export function HomeTestimonials() {
  return (
    <section className="border-t border-border bg-card py-12 md:py-16">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-secondary)]">
            Ils ont changé de carrière avec Gandal
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Ce que disent nos élèves
          </h2>
        </div>

        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, index) => (
            <li
              key={index}
              className="relative flex h-full flex-col rounded-xl border border-border bg-background p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <Quote
                className="absolute right-4 top-4 h-8 w-8 text-[color:var(--brand-primary)]/15"
                aria-hidden
              />

              <Stars rating={t.rating} size="sm" />

              <blockquote className="mt-4 flex-1 text-sm leading-6 text-foreground">
                « {t.quote} »
              </blockquote>

              <footer className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <Avatar
                  src={t.image ?? null}
                  alt={t.name}
                  fallback={t.name[0]}
                  size={40}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </footer>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
