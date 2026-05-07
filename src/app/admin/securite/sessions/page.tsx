import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { revokeSession } from "@/server/actions/admin-security";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Sessions actives" };

export const dynamic = "force-dynamic";

export default async function ActiveSessionsPage() {
  const sessions = await prisma.session.findMany({
    where: { expires: { gt: new Date() } },
    orderBy: { expires: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, name: true, role: true, lastLoginAt: true } },
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Sessions actives
        </h1>
        <p className="text-sm text-muted-foreground">
          {sessions.length} session{sessions.length > 1 ? "s" : ""} actives.
          Révoquez celles qui semblent suspectes.
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
                <th className="px-4 py-3">Expire</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Aucune session active.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.user.name ?? s.user.email}</p>
                      <p className="text-xs text-muted-foreground">{s.user.email}</p>
                    </td>
                    <td className="px-4 py-3">{s.user.role}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.user.lastLoginAt?.toLocaleString("fr-FR") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.expires.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={async () => {
                          "use server";
                          await revokeSession(s.id);
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          Révoquer
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
