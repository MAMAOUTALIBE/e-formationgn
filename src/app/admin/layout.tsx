import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpenText,
  FileText,
  GaugeCircle,
  Layers,
  PercentCircle,
  Tag,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/features/auth/user-menu";
import { Container } from "@/components/ui/container";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-muted/30">
      <header className="border-b border-border bg-[color:var(--brand-primary)] text-primary-foreground">
        <Container className="flex h-16 items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="Accueil">
              <Logo width={170} variant="light" priority />
            </Link>
            <span className="hidden text-xs font-medium uppercase tracking-wide text-primary-foreground/70 sm:inline">
              Administration
            </span>
          </div>

          <UserMenu
            user={{
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
              role: session.user.role,
            }}
          />
        </Container>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="border-b border-border bg-background lg:w-64 lg:border-b-0 lg:border-r">
          <nav className="flex gap-2 overflow-x-auto px-4 py-3 lg:flex-col lg:gap-1 lg:px-3 lg:py-6">
            <NavItem href="/admin" icon={<GaugeCircle className="h-4 w-4" />}>
              Dashboard
            </NavItem>
            <NavItem href="/admin/cours" icon={<BookOpenText className="h-4 w-4" />}>
              Cours (modération)
            </NavItem>
            <NavItem href="/admin/utilisateurs" icon={<Users className="h-4 w-4" />}>
              Utilisateurs
            </NavItem>
            <NavItem href="/admin/categories" icon={<Layers className="h-4 w-4" />}>
              Catégories
            </NavItem>
            <NavItem href="/admin/commissions" icon={<PercentCircle className="h-4 w-4" />}>
              Commissions
            </NavItem>
            <NavItem href="/admin/codes-promo" icon={<Tag className="h-4 w-4" />}>
              Codes promo
            </NavItem>
            <NavItem href="/admin/cms" icon={<FileText className="h-4 w-4" />}>
              Pages CMS
            </NavItem>
          </nav>
        </aside>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavItem({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{children}</span>
    </Link>
  );
}
