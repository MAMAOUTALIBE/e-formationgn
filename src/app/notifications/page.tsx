import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { prisma } from "@/lib/prisma";
import { markAllNotificationsRead } from "@/server/actions/notifications";

export const metadata: Metadata = {
  title: "Notifications",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/notifications");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.isRead).length;

  // Chrome fourni par la coquille de l'espace (cf. layout.tsx).
  return (
    <Container className="max-w-3xl space-y-6">
          <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Notifications" }]} />

          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Notifications
              </h1>
              <p className="text-sm text-muted-foreground">
                {unread} non lue{unread > 1 ? "s" : ""}
              </p>
            </div>
            {unread > 0 ? (
              <form
                action={async () => {
                  "use server";
                  await markAllNotificationsRead();
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  Tout marquer comme lu
                </Button>
              </form>
            ) : null}
          </header>

          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Aucune notification pour le moment.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={notification.url ?? "#"}
                    className={`flex items-start gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:bg-muted ${notification.isRead ? "opacity-70" : ""}`}
                  >
                    {!notification.isRead ? (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--brand-secondary)]" />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{notification.title}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {dateFormatter.format(notification.createdAt)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
    </Container>
  );
}
