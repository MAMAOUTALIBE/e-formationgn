"use server";

// Server Actions liées à l'authentification.
// Toutes ces actions valident leurs entrées avec Zod, normalisent les erreurs
// en messages français, et ne révèlent jamais l'existence d'un compte
// utilisateur (anti-énumération).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { hashPassword } from "@/lib/auth/password";
import {
  emailVerificationExpiry,
  generateToken,
  passwordResetExpiry,
} from "@/lib/auth/tokens";
import { sendTransactionalEmail } from "@/lib/email/client";
import {
  buildPasswordResetMessage,
  buildVerifyEmailMessage,
  buildWelcomeMessage,
} from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/lib/validators/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface ActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Inscription
// ---------------------------------------------------------------------------

export async function registerUser(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms") === "on" || formData.get("acceptTerms") === "true",
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Veuillez corriger les erreurs ci-dessous.",
    };
  }

  const { firstName, lastName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // On ne révèle PAS l'existence du compte. Si le compte existe et n'est
    // pas vérifié, on renvoie quand même un nouveau lien — utile pour relancer.
    if (!existing.emailVerified) {
      await issueVerificationEmail(existing.id, existing.email, existing.firstName);
    }
    return {
      success: true,
      message:
        "Si cette adresse n'était pas déjà associée à un compte, un email de confirmation vient de vous être envoyé.",
    };
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      hashedPassword,
      role: "STUDENT",
      status: "PENDING_VERIFICATION",
    },
  });

  await issueVerificationEmail(user.id, user.email, user.firstName);

  return {
    success: true,
    message:
      "Inscription réussie. Vérifiez votre boîte mail pour confirmer votre adresse email.",
  };
}

async function issueVerificationEmail(
  userId: string,
  email: string,
  firstName: string | null,
): Promise<void> {
  const token = generateToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      identifier: email,
      token,
      expires: emailVerificationExpiry(),
    },
  });

  const verifyUrl = `${APP_URL}/verifier-email?token=${encodeURIComponent(token)}`;
  const { html, text } = buildVerifyEmailMessage(verifyUrl, firstName);

  await sendTransactionalEmail({
    to: email,
    subject: "Confirmez votre adresse email — E-FormationGN",
    html,
    text,
  });
}

// ---------------------------------------------------------------------------
// Vérification d'email (via lien envoyé)
// ---------------------------------------------------------------------------

export type VerifyEmailOutcome =
  | { status: "success" }
  | { status: "already-verified" }
  | { status: "expired" }
  | { status: "invalid" };

export async function verifyEmailToken(token: string): Promise<VerifyEmailOutcome> {
  if (!token || token.length < 10) return { status: "invalid" };

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
  });
  if (!record || !record.userId) return { status: "invalid" };

  if (record.expires.getTime() < Date.now()) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return { status: "expired" };
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) return { status: "invalid" };

  if (user.emailVerified) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return { status: "already-verified" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date(), status: "ACTIVE" },
    }),
    prisma.emailVerificationToken.delete({ where: { id: record.id } }),
  ]);

  // Email de bienvenue (best-effort)
  const { html, text } = buildWelcomeMessage(user.firstName);
  await sendTransactionalEmail({
    to: user.email,
    subject: "Bienvenue sur E-FormationGN",
    html,
    text,
  });

  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Connexion (Credentials)
// ---------------------------------------------------------------------------

export async function loginWithCredentials(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Veuillez corriger les erreurs ci-dessous.",
    };
  }

  const callbackUrl = (formData.get("callbackUrl") as string | null) ?? "/";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: true,
      redirectTo: callbackUrl,
    });
    // signIn redirige : ce return ne sera jamais atteint, mais TS l'exige.
    return { success: true };
  } catch (error) {
    // `redirect()` lève NEXT_REDIRECT — on doit le re-throw pour laisser
    // Next.js le traiter (sinon la redirection est avalée).
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    if (error instanceof AuthError) {
      const cause = error.cause?.err;
      if (cause instanceof Error && cause.message === "EMAIL_NOT_VERIFIED") {
        return {
          success: false,
          message:
            "Votre email n'est pas encore confirmé. Vérifiez votre boîte mail (ou demandez un nouvel envoi).",
        };
      }
      switch (error.type) {
        case "CredentialsSignin":
          return {
            success: false,
            message: "Email ou mot de passe incorrect.",
          };
        case "CallbackRouteError":
        default:
          return {
            success: false,
            message: "Connexion impossible. Réessayez dans un instant.",
          };
      }
    }

    return {
      success: false,
      message: "Erreur inattendue. Réessayez dans un instant.",
    };
  }
}

// ---------------------------------------------------------------------------
// Connexion via Google OAuth
// ---------------------------------------------------------------------------

export async function loginWithGoogle(callbackUrl?: string): Promise<void> {
  await signIn("google", {
    redirect: true,
    redirectTo: callbackUrl ?? "/",
  });
}

// ---------------------------------------------------------------------------
// Demande de réinitialisation de mot de passe
// ---------------------------------------------------------------------------

export async function requestPasswordReset(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const raw = { email: formData.get("email") };
  const parsed = requestPasswordResetSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  // Anti-énumération : on répond toujours pareil même si l'email n'existe pas.
  if (user && user.hashedPassword) {
    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expires: passwordResetExpiry(),
      },
    });

    const resetUrl = `${APP_URL}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
    const { html, text } = buildPasswordResetMessage(resetUrl, user.firstName);

    await sendTransactionalEmail({
      to: user.email,
      subject: "Réinitialisation de votre mot de passe — E-FormationGN",
      html,
      text,
    });
  }

  return {
    success: true,
    message:
      "Si un compte est associé à cette adresse, un email de réinitialisation vient d'être envoyé.",
  };
}

// ---------------------------------------------------------------------------
// Confirmation de la réinitialisation
// ---------------------------------------------------------------------------

export async function resetPassword(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    token: formData.get("token"),
    password: formData.get("password"),
  };
  const parsed = resetPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Le lien est invalide ou le mot de passe ne respecte pas les règles.",
    };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
  });

  if (!record || record.usedAt || record.expires.getTime() < Date.now()) {
    return {
      success: false,
      message:
        "Ce lien de réinitialisation est expiré ou a déjà été utilisé. Veuillez en demander un nouveau.",
    };
  }

  const hashedPassword = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalide les autres jetons en attente pour le même utilisateur.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return {
    success: true,
    message: "Votre mot de passe a bien été réinitialisé. Vous pouvez vous connecter.",
  };
}

// ---------------------------------------------------------------------------
// Renvoi du lien de vérification
// ---------------------------------------------------------------------------

export async function resendVerificationEmail(email: string): Promise<ActionResult> {
  const trimmed = String(email).trim().toLowerCase();
  if (!trimmed) return { success: false, message: "Adresse email invalide." };

  const user = await prisma.user.findUnique({ where: { email: trimmed } });
  if (user && !user.emailVerified) {
    await issueVerificationEmail(user.id, user.email, user.firstName);
  }

  return {
    success: true,
    message:
      "Si un compte non confirmé existe avec cette adresse, un nouvel email vient d'être envoyé.",
  };
}

// ---------------------------------------------------------------------------
// Logout (utilisé dans des formulaires Server Action)
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  const { signOut } = await import("@/auth");
  await signOut({ redirect: true, redirectTo: "/" });
  revalidatePath("/");
  redirect("/");
}
