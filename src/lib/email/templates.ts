// Templates HTML/text pour les emails transactionnels Aiduca.
// Volontairement minimalistes, sobres, conformes au branding (bleu corporate).

interface BrandedEmailParams {
  preview: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

const PRIMARY = "#1E3A8A";
const SECONDARY = "#2563EB";
const TEXT = "#0F172A";
const MUTED = "#475569";
const BORDER = "#E2E8F0";

export function renderBrandedEmail({
  preview,
  heading,
  body,
  ctaLabel,
  ctaUrl,
}: BrandedEmailParams): { html: string; text: string } {
  const buttonHtml =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;">
           <tr>
             <td align="center" bgcolor="${SECONDARY}" style="border-radius:6px;">
               <a href="${ctaUrl}" target="_blank"
                  style="display:inline-block;padding:12px 24px;font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
                 ${ctaLabel}
               </a>
             </td>
           </tr>
         </table>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:${TEXT};">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${preview}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"
                 style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:${PRIMARY};padding:20px 28px;">
                <span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:-0.2px;">
                  E-Formation<span style="color:#0EA5E9;">GN</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 8px 28px;">
                <h1 style="margin:0 0 16px 0;font-size:22px;line-height:30px;color:${TEXT};font-weight:600;">${heading}</h1>
                <div style="font-size:15px;line-height:24px;color:${MUTED};">${body}</div>
                ${buttonHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px 28px;">
                <hr style="border:none;border-top:1px solid ${BORDER};margin:24px 0;" />
                <p style="margin:0;font-size:12px;line-height:18px;color:${MUTED};">
                  Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:12px;color:${MUTED};">
            © ${new Date().getFullYear()} Aiduca — Tous droits réservés.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textCta = ctaLabel && ctaUrl ? `\n\n${ctaLabel} : ${ctaUrl}\n` : "";
  const text = `${heading}\n\n${body.replace(/<[^>]+>/g, "")}${textCta}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nAiduca`;

  return { html, text };
}

// === Templates spécifiques ====================================================

export function buildVerifyEmailMessage(verifyUrl: string, firstName?: string | null) {
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  return renderBrandedEmail({
    preview: "Confirmez votre adresse email pour activer votre compte Aiduca.",
    heading: "Confirmez votre email",
    body: `<p style="margin:0 0 12px 0;">${greeting}</p>
           <p style="margin:0 0 12px 0;">Bienvenue sur Aiduca. Pour activer votre compte, cliquez sur le bouton ci-dessous.</p>
           <p style="margin:0;">Ce lien est valable 24 heures.</p>`,
    ctaLabel: "Confirmer mon email",
    ctaUrl: verifyUrl,
  });
}

export function buildPasswordResetMessage(resetUrl: string, firstName?: string | null) {
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  return renderBrandedEmail({
    preview: "Réinitialisation de votre mot de passe Aiduca.",
    heading: "Réinitialiser votre mot de passe",
    body: `<p style="margin:0 0 12px 0;">${greeting}</p>
           <p style="margin:0 0 12px 0;">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau.</p>
           <p style="margin:0;">Ce lien expire dans 1 heure.</p>`,
    ctaLabel: "Choisir un nouveau mot de passe",
    ctaUrl: resetUrl,
  });
}

export function buildWelcomeMessage(firstName?: string | null) {
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  return renderBrandedEmail({
    preview: "Bienvenue sur Aiduca.",
    heading: "Bienvenue sur Aiduca",
    body: `<p style="margin:0 0 12px 0;">${greeting}</p>
           <p style="margin:0 0 12px 0;">Votre compte est confirmé. Vous pouvez désormais explorer le catalogue et suivre vos premières formations.</p>`,
    ctaLabel: "Découvrir le catalogue",
    ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/cours`,
  });
}
