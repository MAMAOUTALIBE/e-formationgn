import Link from "next/link";

import { auth } from "@/auth";
import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/features/auth/user-menu";
import { CartIcon } from "@/components/features/cart/cart-icon";
import { HeaderSearch } from "@/components/features/courses/header-search";
import { NotificationBell } from "@/components/features/notifications/notification-bell";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { prisma } from "@/lib/prisma";
import { countCartItems } from "@/server/queries/cart";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  const [cartCount, unreadNotifs] = user
    ? await Promise.all([
        countCartItems(user.id),
        prisma.notification.count({
          where: { userId: user.id, isRead: false },
        }),
      ])
    : [0, 0];

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
          aria-label="Accueil E-FormationGN"
        >
          <Logo width={140} priority className="w-[140px] md:w-[170px]" />
        </Link>

        <nav
          className="hidden items-center gap-6 md:flex"
          aria-label="Navigation principale"
        >
          <NavLink href="/cours">Catalogue</NavLink>
          <NavLink href="/categories">Catégories</NavLink>
          {user ? (
            <NavLink href="/apprentissage">Mon apprentissage</NavLink>
          ) : (
            <NavLink href="/devenir-formateur">Devenir formateur</NavLink>
          )}
        </nav>

        <div className="hidden flex-1 max-w-md md:block">
          <HeaderSearch />
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {user ? (
            <>
              <NotificationBell unreadCount={unreadNotifs} />
              <CartIcon count={cartCount} />
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
              <Button variant="ghost" asChild className="hidden md:inline-flex">
                <Link href="/connexion">Connexion</Link>
              </Button>
              <Button
                asChild
                className="hidden bg-[color:var(--brand-mint)] text-[color:var(--neutral-900)] shadow-sm hover:bg-[color:var(--brand-mint-deep)] sm:inline-flex"
              >
                <Link href="/inscription">S&apos;inscrire</Link>
              </Button>
            </>
          )}
          <MobileMenu isLoggedIn={Boolean(user)} role={user?.role} />
        </div>
      </Container>
    </header>
  );
}
