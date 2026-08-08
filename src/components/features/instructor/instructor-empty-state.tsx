import { ListChecks, PenLine, Rocket, Send } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: <PenLine className="h-5 w-5" aria-hidden />,
    title: "1. Décrivez votre cours",
    text: "Titre, catégorie, description et image de couverture.",
  },
  {
    icon: <ListChecks className="h-5 w-5" aria-hidden />,
    title: "2. Construisez le programme",
    text: "Ajoutez des sections, des leçons et leurs vidéos.",
  },
  {
    icon: <Send className="h-5 w-5" aria-hidden />,
    title: "3. Soumettez à la publication",
    text: "Notre équipe valide, puis votre cours part en ligne.",
  },
];

/**
 * Accueil des nouveaux formateurs (aucun cours encore créé) : remplace les
 * tuiles de stats vides par un onboarding clair avec CTA.
 */
export function InstructorEmptyState() {
  return (
    <section data-slot="card" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-[color:var(--brand-primary)]/5 p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--brand-primary)]/10 text-[color:var(--brand-primary)]">
          <Rocket className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Lancez votre premier cours
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Partagez votre savoir avec des milliers d&apos;élèves. La création est
          guidée étape par étape — il suffit de commencer.
        </p>
        <Button asChild size="lg" className="mt-5">
          <Link href="/formateur/cours/nouveau">Créer mon premier cours</Link>
        </Button>
      </div>

      <ol className="grid gap-px bg-border sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.title} className="bg-card p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {step.icon}
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">
              {step.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
