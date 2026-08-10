import Link from "next/link";

import { auth } from "@/auth";
import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/features/auth/user-menu";
import { CartIcon } from "@/components/features/cart/cart-icon";
import { ThemeToggle } from "@/components/features/theme/theme-toggle";
import { isTrainingCenterMode } from "@/lib/platform-mode";
import { HeaderSearch } from "@/components/features/courses/header-search";
import { NotificationBell } from "@/components/features/notifications/notification-bell";
import { CategoriesDropdown } from "@/components/layout/categories-dropdown";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getDictionary } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { countCartItems } from "@/server/queries/cart";
import { listFeaturedCategories } from "@/server/queries/categories";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const { t } = await getDictionary();

  // Toutes ces queries en parallèle. `listFeaturedCategories` est déjà
  // mise en cache 1 h (cf. Sprint 1) — coût négligeable par render.
  const [cartCount, unreadNotifs, headerCategories] = await Promise.all([
    user ? countCartItems(user.id) : Promise.resolve(0),
    user
      ? prisma.notification.count({
          where: { userId: user.id, isRead: false },
        })
      : Promise.resolve(0),
    listFeaturedCategories(20),
  ]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Fine bande gradient marketing */}
      <div
        aria-hidden
        className="h-1 w-full bg-gradient-to-r from-[color:var(--brand-primary)] via-[color:var(--brand-violet)] to-[color:var(--brand-mint)]"
      />

      <Container className="flex h-16 items-center justify-between gap-3 md:gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label="Accueil Gandal"
        >
          <Logo width={140} priority className="w-[140px] md:w-[170px]" />
        </Link>

        <nav
          className="hidden items-center gap-6 lg:flex"
          aria-label="Navigation principale"
        >
          <CategoriesDropdown
            categories={headerCategories.map((c) => ({ slug: c.slug, name: c.name }))}
            label={t.common.categories}
          />
          <NavLink href="/cours">{t.common.catalog}</NavLink>
          {user ? (
            <NavLink href="/apprentissage">{t.common.myLearning}</NavLink>
          ) : (
            <NavLink href="/devenir-formateur">{t.common.becomeInstructor}</NavLink>
          )}
        </nav>

        <div className="hidden flex-1 max-w-md lg:block">
          <HeaderSearch />
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <ThemeToggle className="hidden md:inline-flex" />
          {user ? (
            <>
              <NotificationBell unreadCount={unreadNotifs} />
              {/* Pas de panier en mode centre de formation : aucune vente à
                  l'unité, l'accès est attribué par le centre. */}
              {isTrainingCenterMode() ? null : <CartIcon count={cartCount} />}
              <UserMenu
                user={{
                  name: user.name,
                  email: user.email,
                  image: user.image,
                  role: user.role,
                }}
              />
            </>
          ) : (
            <>
              {/* Connexion : toujours visible (mobile inclus) — accès direct sans
                  passer par le hamburger, c'était la friction principale en mobile. */}
              <Button variant="ghost" asChild size="sm" className="px-2 sm:px-3">
                <Link href="/connexion">{t.common.login}</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="hidden bg-[color:var(--brand-mint)] text-[color:var(--neutral-900)] shadow-sm hover:bg-[color:var(--brand-mint-deep)] sm:inline-flex"
              >
                <Link href="/inscription">{t.common.register}</Link>
              </Button>
            </>
          )}
          <MobileMenu isLoggedIn={Boolean(user)} role={user?.role} />
        </div>
      </Container>
    </header>
  );
}
