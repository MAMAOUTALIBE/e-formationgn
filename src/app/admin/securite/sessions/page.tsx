import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { disconnectUserEverywhere } from "@/server/actions/admin-security";

export const metadata: Metadata = { title: "Connexions récentes" };

export const dynamic = "force-dynamic";

export default async function ActiveSessionsPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    where: { lastLoginAt: { not: null } },
    orderBy: { lastLoginAt: "desc" },
    take: 100,
    select: { id: true, email: true, name: true, role: true, lastLoginAt: true },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Connexions récentes
        </h1>
        <p className="text-sm text-muted-foreground">
          Comptes vus récemment. La plateforme utilise des jetons JWT et ne
          peut pas afficher chaque appareil actif. « Déconnecter partout »
          invalide tous les jetons existants du compte ciblé.
        </p>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Dernier login</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Aucune connexion récente enregistrée.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.name ?? user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {user.lastLoginAt?.toLocaleString("fr-FR") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={async (formData) => {
                          "use server";
                          const userId = formData.get("userId");
                          await disconnectUserEverywhere(
                            typeof userId === "string" ? userId : "",
                          );
                        }}
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={user.id === admin.userId}
                        >
                          {user.id === admin.userId ? "Session actuelle" : "Déconnecter partout"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
