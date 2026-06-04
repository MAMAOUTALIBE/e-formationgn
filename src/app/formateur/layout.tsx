import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpenText,
  CircleHelp,
  GaugeCircle,
  LinkIcon,
  Star,
  Tag,
  Wallet,
} from "lucide-react";

import { auth } from "@/auth";
import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/features/auth/user-menu";
import { Container } from "@/components/ui/container";

import { InstructorNavItem } from "./_components/instructor-nav-item";

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion?callbackUrl=/formateur");
  }
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/devenir-formateur");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-muted/30">
      <header className="border-b border-border bg-background">
        <Container className="flex h-16 items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="Accueil Gandal">
              <Logo width={170} priority />
            </Link>
            <span className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:inline">
              Espace formateur
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
        <aside className="border-b border-[#1E293B] bg-[#0F172A] lg:w-64 lg:border-b-0 lg:border-r">
          <nav className="flex gap-2 overflow-x-auto px-4 py-3 lg:flex-col lg:gap-1 lg:px-3 lg:py-6">
            <InstructorNavItem href="/formateur" exact icon={<GaugeCircle className="h-4 w-4" />}>
              Tableau de bord
            </InstructorNavItem>
            <InstructorNavItem href="/formateur/cours" icon={<BookOpenText className="h-4 w-4" />}>
              Mes cours
            </InstructorNavItem>
            <InstructorNavItem href="/formateur/questions" icon={<CircleHelp className="h-4 w-4" />}>
              Q&amp;A
            </InstructorNavItem>
            <InstructorNavItem href="/formateur/avis" icon={<Star className="h-4 w-4" />}>
              Avis
            </InstructorNavItem>
            <InstructorNavItem href="/formateur/paiements" icon={<Wallet className="h-4 w-4" />}>
              Paiements
            </InstructorNavItem>
            <InstructorNavItem href="/formateur/codes-promo" icon={<Tag className="h-4 w-4" />}>
              Codes promo
            </InstructorNavItem>
            <InstructorNavItem href="/formateur/affiliation" icon={<LinkIcon className="h-4 w-4" />}>
              Affiliation
            </InstructorNavItem>
          </nav>
        </aside>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
