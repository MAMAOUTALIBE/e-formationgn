"use server";

// Server Actions liées au profil utilisateur connecté.
// Toute action vérifie d'abord la session — pas de mutation sans propriétaire.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validators/auth";

import type { ActionResult } from "./auth";

function emptyToNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function updateProfile(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, message: "Vous devez être connecté." };
  }

  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    headline: formData.get("headline") ?? "",
    bio: formData.get("bio") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    linkedinUrl: formData.get("linkedinUrl") ?? "",
    twitterUrl: formData.get("twitterUrl") ?? "",
    youtubeUrl: formData.get("youtubeUrl") ?? "",
  };

  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Veuillez corriger les erreurs ci-dessous.",
    };
  }

  const data = parsed.data;
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`,
      headline: emptyToNull(data.headline),
      bio: emptyToNull(data.bio),
      websiteUrl: emptyToNull(data.websiteUrl),
      linkedinUrl: emptyToNull(data.linkedinUrl),
      twitterUrl: emptyToNull(data.twitterUrl),
      youtubeUrl: emptyToNull(data.youtubeUrl),
    },
  });

  revalidatePath("/profil");
  return { success: true, message: "Votre profil a été mis à jour." };
}

/**
 * Persiste l'URL d'avatar de l'utilisateur après un upload R2 réussi.
 * L'URL est validée : doit pointer vers le bucket public R2 attendu
 * (configuré dans `R2_PUBLIC_URL`). Pas d'URL arbitraire pour éviter
 * qu'un user n'ajoute une URL externe à des fins de tracking ou phishing.
 * `null` pour supprimer l'avatar.
 */
export async function updateAvatarUrl(
  url: string | null,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, message: "Vous devez être connecté." };
  }

  let validated: string | null = null;
  if (url !== null) {
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      validated = null;
    } else {
      // Vérifie que l'URL pointe bien sur notre stockage public ou un
      // domaine OAuth de confiance (Google/Facebook avatars hérités).
      const publicBase = process.env.R2_PUBLIC_URL ?? "";
      const isFromR2 = publicBase && trimmed.startsWith(publicBase);
      const isFromOauth = /^https:\/\/(lh3\.googleusercontent\.com|graph\.facebook\.com)\//.test(trimmed);
      // Stockage local (fallback quand R2 n'est pas configuré) : chemin servi
      // par l'app, écrit uniquement via la route d'upload signée.
      const isLocalUpload = trimmed.startsWith("/uploads/avatars/");
      if (!isFromR2 && !isFromOauth && !isLocalUpload) {
        return {
          success: false,
          message: "URL non autorisée. L'avatar doit être uploadé via le formulaire.",
        };
      }
      validated = trimmed;
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: validated },
  });

  revalidatePath("/profil");
  revalidatePath("/", "layout"); // mise à jour de l'avatar dans le header
  return {
    success: true,
    message: validated ? "Avatar mis à jour." : "Avatar supprimé.",
  };
}
