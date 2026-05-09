import Link from "next/link";

import { Logo } from "@/components/branding/logo";
import { Container } from "@/components/ui/container";
import { getDictionary } from "@/lib/i18n/server";

export async function SiteFooter() {
  const { t } = await getDictionary();
  return (
    <footer className="border-t border-border bg-muted/40">
      <Container className="grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo width={170} />
          <p className="mt-3 text-sm text-muted-foreground">{t.footer.tagline}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">{t.footer.platform}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/cours" className="hover:text-foreground">{t.common.catalog}</Link></li>
            <li><Link href="/categories" className="hover:text-foreground">{t.common.categories}</Link></li>
            <li><Link href="/devenir-formateur" className="hover:text-foreground">{t.common.becomeInstructor}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">{t.footer.about}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/a-propos" className="hover:text-foreground">Gandal</Link></li>
            <li><Link href="/contact" className="hover:text-foreground">{t.footer.contact}</Link></li>
            <li><Link href="/blog" className="hover:text-foreground">{t.footer.blog}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">{t.footer.legal}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/cgv" className="hover:text-foreground">CGV</Link></li>
            <li><Link href="/mentions-legales" className="hover:text-foreground">Mentions légales</Link></li>
            <li><Link href="/confidentialite" className="hover:text-foreground">Confidentialité</Link></li>
            <li><Link href="/cookies" className="hover:text-foreground">Cookies</Link></li>
          </ul>
        </div>
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Gandal. {t.footer.rights}</p>
          <p>{t.footer.rgpd}</p>
        </Container>
      </div>
    </footer>
  );
}
