// Wrapper Resend — fournit un client unique et un mode "dev fallback".
// Si RESEND_API_KEY n'est pas défini, les emails sont logués sur stdout
// (utile en local pour suivre le lien de vérification sans configurer Resend).

import { Resend } from "resend";

import { logError } from "@/lib/logger";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const apiKey = process.env.RESEND_API_KEY;
const fromEmail =
  process.env.RESEND_FROM_EMAIL ?? "Aiduca <onboarding@resend.dev>";

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendTransactionalEmail(
  params: SendEmailParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getResend();

  if (!client) {
    // Mode développement : on log au lieu d'envoyer
    console.warn(
      `\n[email] RESEND_API_KEY absent — email NON envoyé (mode dev).\n` +
        `  À : ${params.to}\n` +
        `  Sujet : ${params.subject}\n` +
        `  --- Contenu texte ---\n${params.text}\n` +
        `  ---\n`,
    );
    return { ok: true };
  }

  try {
    const result = await client.emails.send({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (result.error) {
      logError("email", result.error, { to: params.to, subject: params.subject });
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    logError("email", error, { to: params.to, subject: params.subject });
    return { ok: false, error: message };
  }
}
