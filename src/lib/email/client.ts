// Wrapper Resend — fournit un client unique.
// Les contenus transactionnels contiennent parfois des jetons à usage unique :
// ils ne doivent donc jamais être écrits dans les journaux, même en local.

import { Resend } from "resend";
import { randomUUID } from "node:crypto";

import { logError } from "@/lib/logger";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

export function isTransactionalEmailConfigured(): boolean {
  return Boolean(apiKey);
}

export async function sendTransactionalEmail(
  params: SendEmailParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getResend();
  const correlationId = randomUUID();

  if (!client) {
    console.warn("[email] Fournisseur transactionnel non configuré ; email non envoyé.");
    return { ok: false, error: "Fournisseur email non configuré." };
  }

  try {
    const result = await client.emails.send({
      from: `Aiduca <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (result.error) {
      // Le fournisseur peut inclure le destinataire ou le sujet dans son objet
      // d'erreur. Ne jamais transmettre cet objet brut au logger/Sentry.
      logError("email", new Error("Échec du fournisseur transactionnel."), {
        correlationId,
      });
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    // Même règle pour les exceptions réseau : seul un identifiant opaque et
    // non corrélable à un utilisateur quitte ce module.
    logError("email", new Error("Exception du fournisseur transactionnel."), {
      correlationId,
    });
    return { ok: false, error: message };
  }
}
