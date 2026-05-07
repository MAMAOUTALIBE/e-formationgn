import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  addAdminNoteOnUser,
  banUser,
  changeUserRole,
  deleteUserGdpr,
  exportUserGdprData,
  forceVerifyEmail,
  reactivateUser,
  suspendUser,
} from "@/server/actions/admin-users";
import { startImpersonation } from "@/server/actions/admin-impersonation";
import { getAdminUserDetail } from "@/server/queries/admin-users";

export const metadata: Metadata = {
  title: "Fiche utilisateur — CRM admin",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getAdminUserDetail(id);
  if (!data) notFound();
  const { user, orders, enrollments, recentAudit, notes, spendByCurrency } = data;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/utilisateurs"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour à la liste
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {user.name ?? user.email}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={user.status === "ACTIVE" ? "success" : user.status === "SUSPENDED" ? "warning" : "neutral"}>
              {user.status}
            </StatusBadge>
            <StatusBadge tone="info">{user.role}</StatusBadge>
            {user.bannedAt ? (
              <StatusBadge tone="danger">Banni</StatusBadge>
            ) : null}
            {user.country ? (
              <Badge variant="outline">{user.country}</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.status === "PENDING_VERIFICATION" ? (
            <ServerActionButton
              action={async () => {
                "use server";
                await forceVerifyEmail(user.id);
              }}
              label="Vérifier email"
            />
          ) : null}
          {user.status === "ACTIVE" ? (
            <ServerActionButton
              action={async () => {
                "use server";
                await suspendUser(user.id, "Action admin");
              }}
              label="Suspendre"
            />
          ) : (
            <ServerActionButton
              action={async () => {
                "use server";
                await reactivateUser(user.id);
              }}
              label="Réactiver"
            />
          )}
          <ServerActionButton
            action={async () => {
              "use server";
              await startImpersonation(user.id, "Debug admin");
            }}
            label="Impersonate"
            variant="outline"
          />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Commandes" value={user._count.orders} />
        <MiniStat label="Inscriptions" value={user._count.enrollments} />
        <MiniStat label="Cours créés" value={user._count.coursesAuthored} />
        <MiniStat label="Certificats" value={user._count.certificates} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {spendByCurrency.map((s) => (
          <Card key={s.currency}>
            <CardHeader>
              <CardTitle className="text-base">
                Dépenses {s.currency}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {((s._sum.totalCents ?? 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commandes récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commande.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {o.items.map((i) => i.course.title).join(", ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.createdAt.toLocaleString("fr-FR")} · {o.id.slice(0, 8)}…
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {(o.totalCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                      {o.currency}
                    </p>
                    <StatusBadge tone={o.status === "PAID" ? "success" : o.status === "FAILED" ? "danger" : "warning"}>
                      {o.status}
                    </StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apprentissage</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune inscription.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/cours/${e.course.slug}`}
                    className="min-w-0 flex-1 truncate font-medium text-foreground hover:underline"
                  >
                    {e.course.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {e.progressPercent.toFixed(0)} %{" "}
                    {e.completedAt ? "· Terminé" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes internes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData: FormData) => {
              "use server";
              await addAdminNoteOnUser(user.id, String(formData.get("body") ?? ""));
            }}
            className="flex flex-col gap-2"
          >
            <textarea
              name="body"
              placeholder="Ajoutez une note (visible uniquement par l'équipe)…"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" className="self-end">
              Ajouter
            </Button>
          </form>
          <ul className="space-y-2 text-sm">
            {notes.length === 0 ? (
              <li className="text-muted-foreground">Aucune note pour le moment.</li>
            ) : (
              notes.map((n) => (
                <li key={n.id} className="rounded-md border border-border p-2">
                  <p className="whitespace-pre-wrap text-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.author.name ?? n.author.email} ·{" "}
                    {n.createdAt.toLocaleString("fr-FR")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité (audit)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune entrée d&apos;audit.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span>{a.action}</span>
                  <time className="text-xs text-muted-foreground">
                    {a.createdAt.toLocaleString("fr-FR")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-300/60 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="text-base text-red-900 dark:text-red-200">
            Zone à risque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            action={async () => {
              "use server";
              await banUser(user.id, "Bannissement admin");
            }}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-foreground">
              Bannir le compte (suspend + bloque la reconnexion)
            </span>
            <Button type="submit" size="sm" variant="outline">
              Bannir
            </Button>
          </form>
          <RoleChangeForm currentRole={user.role} userId={user.id} />
          <form
            action={async () => {
              "use server";
              await exportUserGdprData(user.id);
            }}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-foreground">
              Demander l&apos;export RGPD complet
            </span>
            <Button type="submit" size="sm" variant="outline">
              Export RGPD
            </Button>
          </form>
          <form
            action={async () => {
              "use server";
              await deleteUserGdpr(user.id);
            }}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-red-900 dark:text-red-200">
              Demande de suppression définitive (RGPD)
            </span>
            <Button type="submit" size="sm" variant="outline">
              Supprimer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ServerActionButton({
  action,
  label,
  variant,
}: {
  action: () => Promise<void>;
  label: string;
  variant?: "outline";
}) {
  return (
    <form action={action}>
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}

function RoleChangeForm({
  currentRole,
  userId,
}: {
  currentRole: string;
  userId: string;
}) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const role = formData.get("role") as
          | "STUDENT"
          | "INSTRUCTOR"
          | "ADMIN"
          | "MODERATOR"
          | "SUPPORT"
          | "FINANCE";
        await changeUserRole(userId, role);
      }}
      className="flex items-center justify-between gap-3"
    >
      <span className="text-sm text-foreground">Changer le rôle</span>
      <div className="flex gap-2">
        <select
          name="role"
          defaultValue={currentRole}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="STUDENT">Élève</option>
          <option value="INSTRUCTOR">Formateur</option>
          <option value="MODERATOR">Modérateur</option>
          <option value="SUPPORT">Support</option>
          <option value="FINANCE">Finance</option>
          <option value="ADMIN">Administrateur</option>
        </select>
        <Button type="submit" size="sm" variant="outline">
          Appliquer
        </Button>
      </div>
    </form>
  );
}
