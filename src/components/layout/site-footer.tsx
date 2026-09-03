import { Mail, MapPin, Phone, Smartphone } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/branding/logo";
import { NewsletterForm } from "@/components/features/marketing/newsletter-form";
import { Container } from "@/components/ui/container";
import { BRAND } from "@/lib/brand";
import { getDictionary } from "@/lib/i18n/server";

const ESSENTIAL_LINKS = [
  { href: "/cours", label: "Catalogue" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
  { href: "/connexion", label: "Se connecter" },
] as const;

const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgv", label: "CGV" },
  { href: "/confidentialite", label: "Confidentialité" },
] as const;

export async function SiteFooter() {
  const { t } = await getDictionary();

  return (
    <footer className="relative isolate overflow-hidden border-t border-white/20 bg-[#031735] text-white [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-slate-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/footer-modern-building-construction.webp')" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[#031735]/88"
      />

      <Container className="relative z-10 grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,1.35fr)_minmax(18rem,1fr)] lg:gap-12 lg:py-16">
        <section aria-label="Présentation d'Aiduca">
          <Logo width={170} transparentBackground />
          <p className="mt-5 max-w-sm text-base leading-7 text-slate-200">
            {t.footer.tagline}
          </p>
          <div className="@container mt-6 max-w-md">
            <h2 className="text-sm font-semibold text-white">Newsletter mensuelle</h2>
            <p className="mt-1 text-xs leading-5 text-slate-300 @[25rem]:whitespace-nowrap">
              Conseils pratiques, nouveautés du catalogue et actualités du centre.
            </p>
            <NewsletterForm
              source="footer"
              variant="compact"
              className="mt-3 max-w-sm [&_a]:text-emerald-300 [&_input]:text-slate-950 [&_input]:placeholder:text-slate-500"
            />
          </div>
        </section>

        <nav aria-label="Liens essentiels" className="md:col-span-2 lg:col-span-1">
          <h2 className="text-lg font-semibold">Liens essentiels</h2>
          <span
            aria-hidden="true"
            className="mt-3 block h-0.5 w-14 bg-[color:var(--brand-mint-deep)]"
          />
          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-100 sm:text-base lg:gap-x-4 xl:gap-x-6">
            {ESSENTIAL_LINKS.map((link, index) => (
              <li key={link.href} className="flex items-center gap-4 xl:gap-6">
                <Link
                  href={link.href}
                  className="underline-offset-4 transition-colors hover:text-[color:var(--brand-mint)] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {link.label}
                </Link>
                {index < ESSENTIAL_LINKS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-mint-deep)]"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </nav>

        <section
          aria-labelledby="footer-contact-title"
          className="md:row-start-1 md:col-start-2 lg:col-start-3 lg:justify-self-end"
        >
          <h2 id="footer-contact-title" className="text-lg font-semibold">
            Nous contacter
          </h2>
          <span
            aria-hidden="true"
            className="mt-3 block h-0.5 w-14 bg-[color:var(--brand-mint-deep)]"
          />

          <address className="mt-7 space-y-3 text-sm not-italic text-slate-100 sm:text-base">
            <p className="flex items-start gap-3">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-mint-deep)]"
              />
              <span>{BRAND.address}</span>
            </p>
            <p className="flex items-center gap-3">
              <Mail
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[color:var(--brand-mint-deep)]"
              />
              <a
                href={`mailto:${BRAND.email}`}
                className="underline-offset-4 hover:text-white hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {BRAND.email}
              </a>
            </p>
            <p className="flex items-center gap-3">
              <Phone
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[color:var(--brand-mint-deep)]"
              />
              <a
                href={`tel:${BRAND.phone.replaceAll(" ", "")}`}
                className="underline-offset-4 hover:text-white hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {BRAND.phone}
              </a>
            </p>
            <p className="flex items-center gap-3">
              <Smartphone
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[color:var(--brand-mint-deep)]"
              />
              <a
                href={`tel:${BRAND.mobile.replaceAll(" ", "")}`}
                className="underline-offset-4 hover:text-white hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {BRAND.mobile}
              </a>
            </p>
          </address>

          <div className="mt-6 max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.qualiopiLogoUrl}
              alt="Certification Qualiopi — Actions de formation"
              width="150"
              height="119"
              loading="lazy"
              className="rounded-md bg-white p-1.5"
            />
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Certification Qualiopi — certificat {BRAND.qualiopiCertificate}, valide
              jusqu&apos;au {BRAND.qualiopiValidUntil}.
            </p>
          </div>
        </section>
      </Container>

      <div className="relative z-10 border-t border-white/25 bg-[#031735]/45">
        <Container className="flex flex-col items-center justify-between gap-4 py-5 text-center text-xs text-slate-200 sm:flex-row sm:text-left">
          <p>
            © {new Date().getFullYear()} AIDUCA · SIREN {BRAND.siren}. {t.footer.rights}
          </p>
          <nav aria-label="Informations légales">
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-end">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="underline-offset-4 hover:text-white hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>
    </footer>
  );
}
