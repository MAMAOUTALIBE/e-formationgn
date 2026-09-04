// Sections de la page d'accueil : « Pourquoi Aiduca » et
// « Formateurs en vedette ». Composants serveur (pas d'interactivité), aux
// couleurs de la marque.

import {
  Award,
  Clock,
  GraduationCap,
  ChartNoAxesCombined,
  Languages,
  MonitorSmartphone,
} from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Container } from "@/components/ui/container";
import type { FeaturedInstructor } from "@/server/queries/instructors-public";

// --- Pourquoi Aiduca -------------------------------------------------------

const PERKS = [
  { icon: Award, title: "Attestation à la clé", text: "Valorisez le suivi de votre formation avec une attestation Aiduca." },
  { icon: Languages, title: "100% francophone", text: "Des formateurs et un contenu en français." },
  { icon: ChartNoAxesCombined, title: "Progression suivie", text: "Retrouvez votre avancement dans chaque formation attribuée." },
  { icon: MonitorSmartphone, title: "Accessible partout", text: "Suivez vos formations sur ordinateur, tablette ou mobile." },
  { icon: GraduationCap, title: "Formateurs experts", text: "Apprenez auprès de professionnels confirmés." },
  { icon: Clock, title: "À votre rythme", text: "Apprenez où et quand vous le souhaitez." },
];

export function WhyAiduca() {
  return (
    <section className="border-y border-border bg-muted/30 py-12">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pourquoi choisir Aiduca ?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Une plateforme pensée pour la réussite des apprenants francophones.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERKS.map((perk) => {
            const Icon = perk.icon;
            return (
              <div
                key={perk.title}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--brand-secondary)]/10 text-[color:var(--brand-secondary)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {perk.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{perk.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

// --- Formateurs en vedette -------------------------------------------------

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function FeaturedInstructors({
  instructors,
}: {
  instructors: FeaturedInstructor[];
}) {
  if (instructors.length === 0) return null;

  return (
    <section className="py-12">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Nos formateurs experts
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Apprenez auprès de professionnels qui partagent leur savoir-faire.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {instructors.map((ins) => {
            const card = (
              <div className="flex h-full flex-col items-center rounded-xl border border-border bg-card p-5 text-center transition-shadow hover:shadow-md">
                <Avatar
                  src={ins.image}
                  alt={ins.name}
                  fallback={initials(ins.name)}
                  size={72}
                />
                <p className="mt-3 font-semibold text-foreground">{ins.name}</p>
                {ins.headline ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {ins.headline}
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-medium text-[color:var(--brand-secondary)]">
                  {ins.courseCount} {ins.courseCount > 1 ? "formations" : "formation"}
                </p>
              </div>
            );
            return ins.affiliateCode ? (
              <Link key={ins.id} href={`/formateurs/${ins.affiliateCode}`} className="block">
                {card}
              </Link>
            ) : (
              <div key={ins.id}>{card}</div>
            );
          })}

        </div>
      </Container>
    </section>
  );
}
