import type { Metadata } from "next";

import { auth } from "@/auth";
import {
  RevokeRoleButton,
  RoleAssignForm,
} from "@/components/features/admin/role-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Rôles & permissions" };

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const session = await auth();
  const currentUserId = session?.user?.id;
  const roleHolders = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "MODERATOR", "SUPPORT", "FINANCE"] },
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  const roleScopes: Record<string, string> = {
    ADMIN: "Toutes les permissions, y compris la gestion des rôles et la sécurité.",
    MODERATOR: "Modération des cours, avis, Q&A et signalements.",
    SUPPORT: "Tickets de support, litiges, communications utilisateurs.",
    FINANCE: "Transactions, payouts, remboursements, rapports comptables.",
    MANAGER: "Gestionnaire",
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Rôles &amp; permissions
        </h1>
        <p className="text-sm text-muted-foreground">
          Sous-rôles administratifs et liste des comptes les portant.
        </p>
      </header>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Périmètre de chaque rôle</h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(roleScopes).map(([role, scope]) => (
              <li key={role} className="flex items-start gap-3">
                <StatusBadge tone={role === "ADMIN" ? "danger" : role === "MODERATOR" ? "warning" : "info"}>
                  {role}
                </StatusBadge>
                <span className="text-muted-foreground">{scope}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attribuer un rôle</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleAssignForm />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Compte</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Créé le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roleHolders.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name ?? u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={u.role === "ADMIN" ? "danger" : "info"}>
                      {u.role}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.createdAt.toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RevokeRoleButton
                      userId={u.id}
                      email={u.email}
                      isSelf={u.id === currentUserId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
