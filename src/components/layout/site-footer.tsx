// Footer 6 colonnes inspiré Udemy — adapté Aiduca :
//   - Col 1 (double) : logo + tagline + newsletter inline
//   - Col 2 : Découvrir (catalogue, catégories, nouveautés)
//   - Col 3 : Enseigner sur Aiduca (devenir formateur, conditions, dashboard)
//   - Col 4 : Aiduca (à propos, blog, contact, crédits)
//   - Col 5 : Aide & support + mentions légales
// Bottom bar : copyright + sélecteurs langue/devise + RGPD

import Link from "next/link";

import { Logo } from "@/components/branding/logo";
import { NewsletterForm } from "@/components/features/marketing/newsletter-form";
import { Container } from "@/components/ui/container";
import { BRAND } from "@/lib/brand";
import { getDictionary } from "@/lib/i18n/server";

export async function SiteFooter() {
  const { t } = await getDictionary();

  return (
    <footer className="border-t border-border bg-muted/40">
      <Container className="grid gap-10 py-12 lg:grid-cols-6">
        {/* Col 1 — Brand + Newsletter (double largeur) */}
        <div className="lg:col-span-2">
          <Logo width={170} />
          <p className="mt-3 text-sm text-muted-foreground">{t.footer.tagline}</p>
          <div className="mt-5">
            <p className="text-sm font-semibold text-foreground">
              Newsletter mensuelle
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Conseils d&apos;élèves, nouveautés du catalogue et témoignages.
            </p>
            <div className="mt-3 max-w-sm">
              <NewsletterForm source="footer" variant="compact" />
            </div>
          </div>
        </div>

        {/* Col 2 — Découvrir */}
        <div>
          <h3 className="text-sm font-semibold text-foreground">Découvrir</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/cours" className="hover:text-foreground">
                Catalogue
              </Link>
            </li>
            <li>
              <Link href="/categories" className="hover:text-foreground">
                Catégories
              </Link>
            </li>
            <li>
              <Link href="/cours?sort=newest" className="hover:text-foreground">
                Nouveautés
              </Link>
            </li>
            <li>
              <Link href="/cours?sort=popular" className="hover:text-foreground">
                Formations populaires
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3 — Enseigner */}
        <div>
          <h3 className="text-sm font-semibold text-foreground">Enseigner</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/devenir-formateur" className="hover:text-foreground">
                Devenir formateur
              </Link>
            </li>
            <li>
              <Link
                href="/devenir-formateur#conditions"
                className="hover:text-foreground"
              >
                Conditions et rémunération
              </Link>
            </li>
            <li>
              <Link href="/formateur" className="hover:text-foreground">
                Tableau de bord formateur
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 4 — Aiduca */}
        <div>
          <h3 className="text-sm font-semibold text-foreground">Aiduca</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/a-propos" className="hover:text-foreground">
                À propos
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-foreground">
                {t.footer.contact}
              </Link>
            </li>
            <li>
              <Link href="/credits" className="hover:text-foreground">
                Crédits et licences
              </Link>
            </li>
          </ul>
          <div className="mt-5 space-y-1 text-xs text-muted-foreground">
            <p>{BRAND.address}</p>
            <p>
              <a href={`mailto:${BRAND.email}`} className="hover:text-foreground">
                {BRAND.email}
              </a>
            </p>
            <p>
              <a href={`tel:${BRAND.phone.replaceAll(" ", "")}`} className="hover:text-foreground">
                {BRAND.phone}
              </a>
            </p>
            <p>
              <a href={`tel:${BRAND.mobile.replaceAll(" ", "")}`} className="hover:text-foreground">
                {BRAND.mobile}
              </a>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.qualiopiLogoUrl}
              alt="Certification Qualiopi — Actions de formation"
              width="120"
              height="95"
              loading="lazy"
              className="mt-3 rounded bg-white p-1"
            />
            <p>
              Certification Qualiopi — certificat {BRAND.qualiopiCertificate}, valide jusqu&apos;au{" "}
              {BRAND.qualiopiValidUntil}.
            </p>
          </div>
        </div>

        {/* Col 5 — Aide & mentions légales (fusionnées pour rester 6 cols) */}
        <div>
          <h3 className="text-sm font-semibold text-foreground">Aide</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/aide" className="hover:text-foreground">
                Centre d&apos;aide
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-foreground">
                Contacter le support
              </Link>
            </li>
            <li>
              <Link href="/cgv" className="hover:text-foreground">
                CGV
              </Link>
            </li>
            <li>
              <Link href="/mentions-legales" className="hover:text-foreground">
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/confidentialite" className="hover:text-foreground">
                Confidentialité
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="hover:text-foreground">
                Cookies
              </Link>
            </li>
          </ul>
        </div>
      </Container>

      {/* Bottom bar — copyright + sélecteurs */}
      <div className="border-t border-border">
        <Container className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} AIDUCA · SIREN {BRAND.siren}. {t.footer.rights}
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">{t.footer.rgpd}</span>
          </div>
        </Container>
      </div>
    </footer>
  );
}
