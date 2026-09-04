"use client";

// Bouton « Assistant IA » du header du CRM + son panneau latéral.
//
// Le composant n'est rendu que si la plateforme a une clé Groq (le layout
// le décide) : pas de bouton mort quand la fonctionnalité est désactivée.
//
// L'échange n'est pas persisté — c'est un assistant d'orientation, pas une
// messagerie. Fermer le panneau conserve le fil tant que la page vit ; une
// navigation le remet à zéro, ce qui est le comportement attendu pour une aide
// contextuelle.

import { Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { askCrmAssistant } from "@/server/actions/admin-assistant";
import { cn } from "@/lib/utils";

interface Exchange {
  question: string;
  answer: string | null;
  error: string | null;
}

const SUGGESTIONS = [
  "Que dois-je traiter en priorité aujourd'hui ?",
  "Où voir les versements formateurs en attente ?",
  "Comment évolue la progression des apprenants sur la période ?",
];

export function AdminAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  async function ask(raw: string) {
    const trimmed = raw.trim();
    if (trimmed.length < 5 || pending) return;

    setQuestion("");
    setPending(true);
    // On affiche la question tout de suite, réponse en attente : sans ça, la
    // saisie disparaît et l'écran reste figé le temps de l'appel modèle.
    setExchanges((prev) => [...prev, { question: trimmed, answer: null, error: null }]);

    const result = await askCrmAssistant(trimmed);

    setExchanges((prev) =>
      prev.map((ex, i) =>
        i === prev.length - 1
          ? {
              ...ex,
              answer: result.ok ? (result.answer ?? null) : null,
              error: result.ok ? null : (result.message ?? "Échec de l'assistant."),
            }
          : ex,
      ),
    );
    setPending(false);
    // Le fil grandit vers le bas : sans ce recadrage, la réponse arrive
    // hors écran dès le deuxième échange.
    requestAnimationFrame(() => {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--brand-secondary)]/40 bg-[color:var(--brand-secondary)]/5 px-3 py-2 text-sm font-semibold text-[color:var(--brand-secondary)] transition-colors hover:bg-[color:var(--brand-secondary)]/10"
      >
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Assistant IA</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Assistant IA">
          <button
            type="button"
            aria-label="Fermer l'assistant"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[color:var(--brand-secondary)]" aria-hidden />
                <span className="text-sm font-semibold text-foreground">Assistant IA</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>

            <div ref={feedRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {exchanges.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Posez une question sur l&apos;activité de la plateforme ou sur
                    l&apos;endroit où trouver un écran. L&apos;assistant lit les
                    chiffres du tableau de bord ; il ne modifie rien.
                  </p>
                  <ul className="space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => ask(s)}
                          className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                exchanges.map((ex, i) => (
                  <div key={i} className="space-y-2">
                    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[color:var(--brand-secondary)] px-3 py-2 text-sm text-white">
                      {ex.question}
                    </p>
                    {ex.answer ? (
                      <p className="w-fit max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
                        {ex.answer}
                      </p>
                    ) : ex.error ? (
                      <p className="w-fit max-w-[90%] rounded-2xl rounded-bl-sm bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                        {ex.error}
                      </p>
                    ) : (
                      <p className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Réflexion…
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
              className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3"
            >
              <input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={1000}
                placeholder="Votre question…"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
              />
              <button
                type="submit"
                disabled={pending || question.trim().length < 5}
                aria-label="Envoyer"
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-secondary)] text-white transition-opacity",
                  (pending || question.trim().length < 5) && "opacity-40",
                )}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
