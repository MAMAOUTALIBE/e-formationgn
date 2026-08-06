"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  resetCenterAccountPassword,
  type CreateAccountResult,
} from "@/server/actions/admin-accounts";

const initialState: CreateAccountResult = { success: false };

/**
 * Identifiants d'un compte, côté centre de formation.
 *
 * Le mot de passe en cours n'est PAS affichable, et ce n'est pas une limite
 * de cet écran : la base ne conserve qu'une empreinte bcrypt, irréversible
 * par construction. Le seul geste possible pour un titulaire qui a perdu le
 * sien est d'en générer un nouveau — c'est ce que fait ce bloc, et le
 * nouveau mot de passe ne s'affiche qu'une fois.
 *
 * Il apparaît masqué par défaut : les comptes d'une promotion se créent
 * souvent en salle ou en partage d'écran.
 */
export function AccountCredentials({
  userId,
  email,
  passwordChangedAt,
}: {
  userId: string;
  email: string;
  /** Déjà mis en forme côté serveur — un Date traverse mal la frontière client. */
  passwordChangedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    resetCenterAccountPassword,
    initialState,
  );
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const password = state.temporaryPassword;

  // On mémorise QUEL mot de passe est démasqué, pas un simple booléen : une
  // regénération produit une autre valeur, la comparaison échoue et le nouveau
  // mot de passe repart masqué. Un booléen serait resté à « affiché » et
  // l'aurait révélé à l'insu de l'admin.
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const revealed = password !== undefined && revealedFor === password;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Identifiant de connexion
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground">
            {email}
          </code>
          <CopyButton value={email} label="Copier l'identifiant" />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mot de passe
        </p>

        {password ? (
          <div className="mt-1.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-[color:var(--brand-success)]/40 bg-[color:var(--brand-success)]/10 px-3 py-2 font-mono text-base tracking-wide text-foreground">
                {revealed ? password : "•".repeat(password.length)}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={revealed}
                onClick={() => setRevealedFor(revealed ? null : password)}
              >
                {revealed ? (
                  <>
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Masquer
                  </>
                ) : (
                  <>
                    <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Afficher
                  </>
                )}
              </Button>
              <CopyButton value={password} label="Copier le mot de passe" />
            </div>
            <Alert variant="success">
              <AlertDescription>
                Nouveau mot de passe pour {state.createdEmail ?? email}.
                Transmettez-le maintenant : il ne sera plus affiché après avoir
                quitté cette page. Les sessions ouvertes de ce compte ont été
                fermées.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="mt-1.5 space-y-2">
            <code className="block rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-base tracking-wide text-muted-foreground">
              ••••••••••••
            </code>
            <p className="text-xs text-muted-foreground">
              Le mot de passe en cours n&apos;est consultable par personne, pas
              même par un administrateur : il n&apos;est pas conservé, seule une
              empreinte chiffrée irréversible l&apos;est. Si la personne a perdu
              le sien, générez-en un nouveau — il s&apos;affichera ici une seule
              fois.
            </p>
          </div>
        )}

        {!state.success && state.message ? (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {passwordChangedAt
            ? `Dernier changement de mot de passe : ${passwordChangedAt}`
            : "Mot de passe jamais changé depuis la création du compte."}
        </p>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="userId" value={userId} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            {pending ? "Génération…" : "Générer un nouveau mot de passe"}
          </Button>
        </form>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Générer un nouveau mot de passe ?"
        description={`L'ancien mot de passe de ${email} cessera immédiatement de fonctionner et toutes ses sessions ouvertes seront fermées — s'il est en cours de leçon, il sera déconnecté. Le nouveau ne s'affichera qu'une fois.`}
        confirmLabel="Générer"
        destructive
        onConfirm={() => {
          formRef.current?.requestSubmit();
          setConfirming(false);
        }}
      />
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papier refusé (http, permission) — la valeur reste sélectionnable */
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <>
          <Check
            className="mr-1.5 h-3.5 w-3.5 text-[color:var(--brand-success)]"
            aria-hidden
          />
          Copié
        </>
      ) : (
        <>
          <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Copier
        </>
      )}
    </Button>
  );
}
