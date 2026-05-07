import type { Metadata } from "next";
import {
  AlertTriangle,
  BookOpenText,
  PercentCircle,
  ShoppingCart,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatPriceFromCents } from "@/lib/money";
import { getAdminDashboardStats } from "@/server/queries/admin";

export const metadata: Metadata = {
  title: "Administration",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tableau de bord
        </h1>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble de la plateforme.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Utilisateurs"
          value={stats.totalUsers.toLocaleString("fr-FR")}
          hint={`${stats.totalInstructors} formateur${stats.totalInstructors > 1 ? "s" : ""}`}
        />
        <StatCard
          icon={<BookOpenText className="h-4 w-4" />}
          label="Cours publiés"
          value={stats.publishedCourses.toLocaleString("fr-FR")}
          hint={`${stats.totalCourses} au total`}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="En modération"
          value={stats.pendingCourses.toLocaleString("fr-FR")}
          hint="À traiter"
        />
        <StatCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Commandes payées"
          value={stats.paidOrders.toLocaleString("fr-FR")}
          hint={`${stats.totalOrders} commandes au total`}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Revenus bruts
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {formatPriceFromCents(stats.byCurrency.EUR.gross, "EUR")}
            </p>
            <p className="text-sm text-muted-foreground">
              + {formatPriceFromCents(stats.byCurrency.USD.gross, "USD")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <PercentCircle className="h-3.5 w-3.5" />
              Commissions plateforme
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {formatPriceFromCents(stats.byCurrency.EUR.platform, "EUR")}
            </p>
            <p className="text-sm text-muted-foreground">
              + {formatPriceFromCents(stats.byCurrency.USD.platform, "USD")}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
