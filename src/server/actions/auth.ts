"use server";

// Server Actions liées à l'authentification.
// Toutes ces actions valident leurs entrées avec Zod, normalisent les erreurs
// en messages français, et ne révèlent jamais l'existence d'un compte
// utilisateur (anti-énumération).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { isAutoVerifyEmailEnabled } from "@/lib/auth/auto-verify";
import {
  getEmailLockoutState,
  lockoutMessage,
} from "@/lib/auth/login-attempts";
import { fakeVerifyPassword, hashPassword } from "@/lib/auth/password";
import { checkPasswordPwned } from "@/lib/auth/pwned-passwords";
import {
  checkIpRateLimit,
  rateLimitMessage,
} from "@/lib/auth/rate-limit-ip";
import { safeCallbackUrl } from "@/lib/auth/safe-redirect";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { isTrainingCenterMode } from "@/lib/platform-mode";
import {
  emailVerificationExpiry,
  generateToken,
  passwordResetExpiry,
} from "@/lib/auth/tokens";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "@/lib/email/client";
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
  // En mode centre de formation, seuls des comptes créés depuis le CRM
  // existent. Le refus est ici, côté serveur : masquer la page d'inscription
  // n'empêcherait pas d'appeler l'action directement.
  if (isTrainingCenterMode()) {
    return {
      success: false,
      message:
        "Les comptes sont créés par le centre de formation. Rapprochez-vous du secrétariat pour obtenir vos identifiants.",
    };
  }

  const rl = await checkIpRateLimit({
    prefix: "auth:register",
    windowMs: 60 * 60 * 1000,
    max: 5,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

  // Captcha Turnstile (no-op si non configuré).
  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response"));
  if (!captcha.ok) return { success: false, message: captcha.message };

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

  // Vérification HaveIBeenPwned : on bloque les mots de passe connus dans
  // des fuites publiques (k-anonymity → password jamais transmis en clair).
  // Dégrade gracieusement si l'API est injoignable (n'oblige pas l'attente).
  const pwned = await checkPasswordPwned(password);
  if (pwned.ok && pwned.shouldReject) {
    return {
      success: false,
      fieldErrors: {
        password: [
          `Ce mot de passe a été compromis dans une fuite publique (vu ${pwned.count.toLocaleString("fr-FR")} fois). Choisissez-en un autre.`,
        ],
      },
      message:
        "Veuillez choisir un mot de passe qui n'a pas été compromis dans une fuite publique.",
    };
  }

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

  // Contournement temporaire : tant que l'envoi d'emails (Resend) n'est pas
  // configuré, on active directement le compte pour ne pas bloquer l'inscription.
  const autoVerify = isAutoVerifyEmailEnabled();

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      hashedPassword,
      role: "STUDENT",
      status: autoVerify ? "ACTIVE" : "PENDING_VERIFICATION",
      emailVerified: autoVerify ? new Date() : null,
    },
  });

  if (autoVerify) {
    return {
      success: true,
      message: "Inscription réussie. Vous pouvez vous connecter dès maintenant.",
    };
  }

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
    subject: "Confirmez votre adresse email — Aiduca",
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
    subject: "Bienvenue sur Aiduca",
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
  const rl = await checkIpRateLimit({
    prefix: "auth:login",
    windowMs: 15 * 60 * 1000,
    max: 10,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

  // Captcha Turnstile (no-op si non configuré).
  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response"));
  if (!captcha.ok) return { success: false, message: captcha.message };

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

  // Account lockout : 5 échecs sur 15 min sur le même email → blocage temporaire
  // (en plus du rate-limit IP global, qui protège contre la distribution
  // des essais sur plusieurs comptes).
  const lockout = await getEmailLockoutState(parsed.data.email);
  if (lockout.locked) {
    return { success: false, message: lockoutMessage(lockout.unlockAt) };
  }

  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));

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
    redirectTo: safeCallbackUrl(callbackUrl),
  });
}

// ---------------------------------------------------------------------------
// Demande de réinitialisation de mot de passe
// ---------------------------------------------------------------------------

export async function requestPasswordReset(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const rl = await checkIpRateLimit({
    prefix: "auth:reset-request",
    windowMs: 60 * 60 * 1000,
    max: 5,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

  const raw = { email: formData.get("email") };
  const parsed = requestPasswordResetSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Ce contrôle précède la recherche utilisateur afin que l'indisponibilité
  // globale du fournisseur produise exactement la même réponse pour toutes
  // les adresses (anti-énumération).
  if (!isTransactionalEmailConfigured()) {
    await fakeVerifyPassword(parsed.data.email);
    return {
      success: false,
      message:
        "Le service de récupération est temporairement indisponible. Veuillez réessayer plus tard.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  // Anti-énumération : on répond toujours pareil même si l'email n'existe pas,
  // ET on burn ~250 ms de CPU côté serveur quand l'utilisateur n'existe pas
  // pour égaliser le timing avec un envoi email réel (anti timing-leak).
  if (user && user.hashedPassword) {
    const token = generateToken();
    const resetToken = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expires: passwordResetExpiry(),
      },
    });

    const resetUrl = `${APP_URL}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
    const { html, text } = buildPasswordResetMessage(resetUrl, user.firstName);

    const delivery = await sendTransactionalEmail({
      to: user.email,
      subject: "Réinitialisation de votre mot de passe — Aiduca",
      html,
      text,
    });

    if (!delivery.ok) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
    }
  } else {
    await fakeVerifyPassword(parsed.data.email);
  }

  return {
    success: true,
    message:
      "Votre demande a été traitée. Si un compte est associé à cette adresse et que le service est disponible, vous recevrez les instructions par email.",
  };
}

// ---------------------------------------------------------------------------
// Confirmation de la réinitialisation
// ---------------------------------------------------------------------------

export async function resetPassword(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const rl = await checkIpRateLimit({
    prefix: "auth:reset-confirm",
    windowMs: 15 * 60 * 1000,
    max: 10,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

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

  // Même contrôle HIBP qu'à l'inscription : on n'autorise pas le reset vers
  // un mot de passe compromis.
  const pwned = await checkPasswordPwned(parsed.data.password);
  if (pwned.ok && pwned.shouldReject) {
    return {
      success: false,
      fieldErrors: {
        password: [
          "Ce mot de passe a été compromis dans une fuite publique. Choisissez-en un autre.",
        ],
      },
      message:
        "Veuillez choisir un mot de passe qui n'a pas été compromis.",
    };
  }

  const hashedPassword = await hashPassword(parsed.data.password);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      // passwordChangedAt révoque toutes les sessions JWT antérieures
      // (cf. JWT callback dans src/auth.ts qui vérifie token.iat).
      data: { hashedPassword, passwordChangedAt: now },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    // Invalide les autres jetons en attente pour le même utilisateur.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
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
  const rl = await checkIpRateLimit({
    prefix: "auth:resend-verify",
    windowMs: 60 * 60 * 1000,
    max: 5,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

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
