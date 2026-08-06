import {
  AlertTriangle,
  BarChart3,
  BookOpenText,
  GaugeCircle,
  GraduationCap,
  LifeBuoy,
  Megaphone,
  Settings2,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

import { AdminSidebarLink } from "@/components/features/admin/admin-sidebar-link";
import type { AdminSidebarBadges } from "@/server/queries/admin-sidebar";

interface AdminSidebarProps {
  badges: AdminSidebarBadges;
}

export function AdminSidebar({ badges }: AdminSidebarProps) {
  return (
    <nav className="flex flex-col gap-6 px-3 py-6 text-sm" aria-label="Navigation admin">
      <AdminSidebarLink
        href="/admin"
        exact
        icon={<GaugeCircle className="h-4 w-4" />}
        label="Vue d'ensemble"
      />

      <Section title="Pilotage business">
        <AdminSidebarLink
          href="/admin/analytics"
          icon={<BarChart3 className="h-4 w-4" />}
          label="Analytics"
        />
        <AdminSidebarLink
          href="/admin/finances"
          icon={<Wallet className="h-4 w-4" />}
          label="Finances"
        />
        <AdminSidebarLink
          href="/admin/marketing"
          icon={<Megaphone className="h-4 w-4" />}
          label="Marketing"
        />
      </Section>

      <Section title="Gestion communauté">
        <AdminSidebarLink
          href="/admin/utilisateurs"
          icon={<Users className="h-4 w-4" />}
          label="Utilisateurs"
        />
        <AdminSidebarLink
          href="/admin/formateurs"
          icon={<GraduationCap className="h-4 w-4" />}
          label="Formateurs"
        />
        <AdminSidebarLink
          href="/admin/support"
          icon={<LifeBuoy className="h-4 w-4" />}
          label="Support"
          badge={badges.openTickets + badges.openDisputes}
        />
      </Section>

      <Section title="Catalogue et qualité">
        <AdminSidebarLink
          href="/admin/cours"
          icon={<BookOpenText className="h-4 w-4" />}
          label="Cours"
          badge={badges.pendingCourses}
        />
        <AdminSidebarLink
          href="/admin/moderation"
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Modération"
          badge={badges.pendingReports}
        />
      </Section>

      <Section title="Configuration">
        <AdminSidebarLink
          href="/admin/parametres"
          icon={<Settings2 className="h-4 w-4" />}
          label="Paramètres"
        />
        <AdminSidebarLink
          href="/admin/securite"
          icon={<Shield className="h-4 w-4" />}
          label="Sécurité"
          badge={badges.pendingGdpr}
        />
      </Section>
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--admin-sidebar-muted,var(--muted-foreground))]">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
