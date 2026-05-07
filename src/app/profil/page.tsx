import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProfileForm } from "@/components/features/auth/profile-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Mon profil",
};

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Élève",
  INSTRUCTOR: "Formateur",
  ADMIN: "Administrateur",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion?callbackUrl=/profil");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    redirect("/connexion");
  }

  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim() || user.email[0].toUpperCase();

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-muted/40 py-10">
        <Container className="space-y-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar
                src={user.image}
                alt={user.name ?? user.email}
                fallback={initials}
                size={56}
              />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {user.name ?? "Mon profil"}
                </h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
              <CardDescription>
                Ces informations apparaissent sur votre page publique de formateur (le cas échéant)
                et dans les certificats que vous obtenez.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                defaultValues={{
                  firstName: user.firstName ?? "",
                  lastName: user.lastName ?? "",
                  headline: user.headline ?? "",
                  bio: user.bio ?? "",
                  websiteUrl: user.websiteUrl ?? "",
                  linkedinUrl: user.linkedinUrl ?? "",
                  twitterUrl: user.twitterUrl ?? "",
                  youtubeUrl: user.youtubeUrl ?? "",
                }}
              />
            </CardContent>
          </Card>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
