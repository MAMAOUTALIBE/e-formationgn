"use server";

// Server Actions liées au profil utilisateur connecté.
// Toute action vérifie d'abord la session — pas de mutation sans propriétaire.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  buildProfileUpdate,
  canUpdateProfileIdentity,
} from "@/lib/profile-update";
import { prisma } from "@/lib/prisma";
import {
  updateProfileSchema,
  updateStudentPublicProfileSchema,
} from "@/lib/validators/auth";

import type { ActionResult } from "./auth";

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
    facebookUrl: formData.get("facebookUrl") ?? "",
    twitterUrl: formData.get("twitterUrl") ?? "",
    youtubeUrl: formData.get("youtubeUrl") ?? "",
  };

  const schema = session.user.role === "STUDENT"
    ? updateStudentPublicProfileSchema
    : updateProfileSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Veuillez corriger les erreurs ci-dessous.",
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: buildProfileUpdate(session.user.role, parsed.data),
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

  if (!canUpdateProfileIdentity(session.user.role)) {
    return {
      success: false,
      message: "La photo de profil d’un apprenant ne peut pas être modifiée.",
    };
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
