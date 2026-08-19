// Bande « Ils nous font confiance » — équivalent des logos d'entreprises
// chez Udemy. Sans accord de partenariat formel, on affiche des **noms
// d'organisations cibles francophones** dans un style typographique épuré
// (pas de logos image, pour éviter usage abusif de marques).
//
// Quand de vrais partenaires sont signés, remplacer par <Image> sur des
// logos officiels reçus, avec consentement écrit.

import { Container } from "@/components/ui/container";

const TRUSTED_BY = [
  "Orange",
  "Sonatel",
  "Total Énergies",
  "MTN",
  "AfricaInvest",
  "Banque Atlantique",
];

export function HomeTrustedBy() {
  return (
    <section className="border-y border-border bg-muted/30 py-8">
      <Container>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Ils forment leurs équipes sur Aiduca
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUSTED_BY.map((name) => (
            <li
              key={name}
              className="text-base font-bold uppercase tracking-wide text-foreground/40 transition-colors hover:text-foreground/70"
            >
              {name}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
