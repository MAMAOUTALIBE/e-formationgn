import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { applyUserAction } from "@/server/actions/admin";
import { listUsersForAdmin } from "@/server/queries/admin";

export const metadata: Metadata = {
  title: "Utilisateurs",
};

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Élève",
  INSTRUCTOR: "Formateur",
  ADMIN: "Admin",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  PENDING_VERIFICATION: "Email non vérifié",
  DELETED: "Supprimé",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const users = await listUsersForAdmin(params.q);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Utilisateurs</h1>
      </header>

      <form className="flex max-w-md gap-2">
        <Input name="q" placeholder="Email, nom…" defaultValue={params.q ?? ""} />
        <Button type="submit">Rechercher</Button>
      </form>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Statut</th>
                <th className="hidden px-4 py-3 sm:table-cell">Inscrit le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {user.name ?? user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={user.status === "ACTIVE" ? "success" : "outline"}
                      className={user.status === "SUSPENDED" ? "text-destructive border-destructive" : ""}
                    >
                      {STATUS_LABELS[user.status] ?? user.status}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {dateFormatter.format(user.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {user.status === "ACTIVE" ? (
                        <UserActionButton userId={user.id} action="suspend" label="Suspendre" />
                      ) : null}
                      {user.status === "SUSPENDED" ? (
                        <UserActionButton
                          userId={user.id}
                          action="reactivate"
                          label="Réactiver"
                        />
                      ) : null}
                      {user.role !== "ADMIN" ? (
                        <UserActionButton
                          userId={user.id}
                          action="promote_admin"
                          label="Admin"
                        />
                      ) : (
                        <UserActionButton
                          userId={user.id}
                          action="demote_admin"
                          label="Retirer admin"
                        />
                      )}
                    </div>
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

function UserActionButton({
  userId,
  action,
  label,
}: {
  userId: string;
  action: string;
  label: string;
}) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        formData.set("userId", userId);
        formData.set("action", action);
        await applyUserAction(formData);
      }}
    >
      <Button type="submit" variant="outline" size="sm">
        {label}
      </Button>
    </form>
  );
}
