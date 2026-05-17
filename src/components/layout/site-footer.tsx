// Footer 6 colonnes inspiré Udemy — adapté Gandal :
//   - Col 1 (double) : logo + tagline + newsletter inline
//   - Col 2 : Découvrir (catalogue, catégories, nouveautés)
//   - Col 3 : Enseigner sur Gandal (devenir formateur, conditions, dashboard)
//   - Col 4 : Gandal (à propos, blog, contact, crédits)
//   - Col 5 : Aide & support + mentions légales
// Bottom bar : copyright + sélecteurs langue/devise + RGPD

import Link from "next/link";

import { Logo } from "@/components/branding/logo";
import { CurrencyToggle } from "@/components/features/preferences/currency-toggle";
import { NewsletterForm } from "@/components/features/marketing/newsletter-form";
import { Container } from "@/components/ui/container";
import { getCurrentCurrency } from "@/lib/currency";
import { getDictionary } from "@/lib/i18n/server";

export async function SiteFooter() {
  const [{ t }, currency] = await Promise.all([
    getDictionary(),
    getCurrentCurrency(),
  ]);

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
                Cours populaires
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

        {/* Col 4 — Gandal */}
        <div>
          <h3 className="text-sm font-semibold text-foreground">Gandal</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/a-propos" className="hover:text-foreground">
                À propos
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-foreground">
                {t.footer.blog}
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
              <Link href="/cgv#remboursement" className="hover:text-foreground">
                Remboursement
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
            © {new Date().getFullYear()} Gandal. {t.footer.rights}
          </p>
          <div className="flex items-center gap-3">
            <CurrencyToggle current={currency} />
            <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
            <span className="hidden sm:inline">{t.footer.rgpd}</span>
          </div>
        </Container>
      </div>
    </footer>
  );
}
