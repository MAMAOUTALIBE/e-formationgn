"use client";

// Widget public Aiduca-IA : bouton flottant + panneau de conversation.
//
// Le composant n'est monté que si la plateforme a une clé Anthropic (décision
// prise côté serveur dans assistant-mount.tsx) : pas de bouton mort quand la
// fonctionnalité est désactivée.
//
// Le fil est persisté côté serveur et rechargé via un cookie de conversation :
// contrairement à l'assistant du CRM, une navigation ne remet pas la
// discussion à zéro — un visiteur qui compare deux formations garde son
// contexte en passant de l'une à l'autre.

import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { MarkdownContent } from "@/components/features/learning/markdown-content";
import { AssistantLeadForm } from "@/components/features/assistant/assistant-lead-form";
import { cn } from "@/lib/utils";
import {
  askAssistant,
  loadAssistantHistory,
  type AssistantMessageView,
} from "@/server/actions/assistant";

interface CourseAction {
  slug: string;
  title: string;
  url: string;
}

interface Entry {
  id: string;
  role: "USER" | "ASSISTANT";
  text: string;
  courses: CourseAction[];
  offerAdvisor: boolean;
  suggestions: string[];
  error?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "Quelles formations proposez-vous ?",
  "Comment se déroule une inscription ?",
  "Quels sont les prérequis pour débuter ?",
];

const MIN_QUESTION_LENGTH = 5;

interface AiducaAssistantProps {
  /** Slug de la formation consultée, quand le widget s'ouvre depuis sa page. */
  courseSlug?: string | null;
}

export function AiducaAssistant({ courseSlug = null }: AiducaAssistantProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showLeadForm, setShowLeadForm] = useState(false);

  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const historyLoadedRef = useRef(false);
  // Compteur d'identifiants locaux : `Date.now()` serait un appel impur
  // dans le corps du composant, et deux messages postés dans la même
  // milliseconde partageraient leur clé React.
  const sequenceRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
    });
  }, []);

  // Recharge le fil au premier affichage seulement : le refaire à chaque
  // ouverture écraserait les échanges de la session en cours.
  useEffect(() => {
    if (!open || historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    void loadAssistantHistory()
      .then((messages) => {
        if (messages.length === 0) return;
        setEntries(messages.map(toEntry));
        scrollToBottom();
      })
      .catch(() => {
        // Un historique indisponible n'empêche pas de poser une question.
      });
  }, [open, scrollToBottom]);

  // Échap, piège à focus et restitution du focus à la fermeture — mêmes
  // garanties que ConfirmDialog, sur lequel ce panneau est calqué.
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute("hidden"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyboard);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyboard);
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  async function ask(raw: string) {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_QUESTION_LENGTH || pending) return;

    setQuestion("");
    setPending(true);
    setShowLeadForm(false);
    // La question s'affiche immédiatement : sans ça la saisie disparaît et
    // l'écran reste figé le temps de l'appel modèle.
    sequenceRef.current += 1;
    const askedId = `local-${sequenceRef.current}`;
    setEntries((prev) => [
      ...prev,
      {
        id: askedId,
        role: "USER",
        text: trimmed,
        courses: [],
        offerAdvisor: false,
        suggestions: [],
      },
    ]);
    scrollToBottom();

    try {
      const result = await askAssistant({
        question: trimmed,
        ...(courseSlug ? { courseSlug } : {}),
      });

      setEntries((prev) => [
        ...prev,
        result.ok && result.answer
          ? {
              id: `${askedId}-a`,
              role: "ASSISTANT",
              text: result.answer.text,
              courses: result.answer.courses,
              offerAdvisor: result.answer.offerAdvisor,
              suggestions: result.answer.suggestions,
            }
          : {
              id: `${askedId}-e`,
              role: "ASSISTANT",
              text: result.message ?? "L'assistant est momentanément indisponible.",
              courses: [],
              offerAdvisor: true,
              suggestions: [],
              error: true,
            },
      ]);
    } finally {
      setPending(false);
      scrollToBottom();
    }
  }

  const lastEntry = entries[entries.length - 1];
  const suggestions =
    entries.length === 0
      ? DEFAULT_SUGGESTIONS
      : (lastEntry?.role === "ASSISTANT" ? lastEntry.suggestions : []);

  return (
    <>
      <button
        type="button"
        data-testid="assistant-launcher"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Le décalage vient du bandeau cookies, qui publie la place qu'il
        // occupe : sans ça le bouton se retrouve dessous et devient
        // inatteignable pour tout visiteur n'ayant pas encore accepté.
        style={{ bottom: "calc(1rem + var(--cookie-banner-space, 0px))" }}
        className="fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-secondary)] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-secondary)] sm:right-6"
      >
        <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
        <span>Aiduca-IA</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Aiduca-IA, assistant du centre de formation"
        >
          <button
            type="button"
            aria-label="Fermer l'assistant"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <aside
            ref={panelRef}
            data-testid="assistant-panel"
            className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles
                  className="h-4 w-4 text-[color:var(--brand-secondary)]"
                  aria-hidden
                />
                <span className="text-sm font-semibold text-foreground">Aiduca-IA</span>
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

            <div
              ref={feedRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
            >
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Posez une question sur les formations Aiduca, les prérequis,
                  les modalités d&apos;inscription ou l&apos;accès à la
                  plateforme. Les réponses s&apos;appuient uniquement sur les
                  informations publiées par le centre.
                </p>
              ) : (
                entries.map((entry) =>
                  entry.role === "USER" ? (
                    <p
                      key={entry.id}
                      className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[color:var(--brand-secondary)] px-3 py-2 text-sm text-white"
                    >
                      {entry.text}
                    </p>
                  ) : (
                    <div key={entry.id} className="space-y-2">
                      <div
                        data-testid="assistant-answer"
                        className={cn(
                          "w-fit max-w-[92%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm",
                          entry.error
                            ? "bg-red-500/10 text-red-700 dark:text-red-300"
                            : "bg-muted text-foreground",
                        )}
                      >
                        <MarkdownContent source={entry.text} />
                      </div>

                      {entry.courses.length > 0 ? (
                        <ul className="flex flex-wrap gap-2">
                          {entry.courses.map((course) => (
                            <li key={course.slug}>
                              <Link
                                href={course.url}
                                data-testid="assistant-course-link"
                                className="inline-flex items-center rounded-lg border border-[color:var(--brand-secondary)]/40 bg-[color:var(--brand-secondary)]/5 px-3 py-1.5 text-sm font-medium text-[color:var(--brand-secondary)] transition-colors hover:bg-[color:var(--brand-secondary)]/10"
                              >
                                Voir la formation : {course.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {entry.offerAdvisor ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            data-testid="assistant-escalate"
                            onClick={() => setShowLeadForm(true)}
                            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            Contacter un conseiller
                          </button>
                          <Link
                            href="/contact"
                            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            Demander mon inscription
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ),
                )
              )}

              {pending ? (
                <p className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Recherche dans les informations d&apos;Aiduca…
                </p>
              ) : null}

              {showLeadForm ? (
                <div
                  data-testid="assistant-lead-form"
                  className="rounded-xl border border-border p-3"
                >
                  <AssistantLeadForm
                    courseSlug={courseSlug}
                    onDone={() => setShowLeadForm(false)}
                  />
                </div>
              ) : null}

              {!pending && !showLeadForm && suggestions.length > 0 ? (
                <ul className="space-y-2">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        data-testid="assistant-suggestion"
                        onClick={() => void ask(s)}
                        className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
              className="shrink-0 border-t border-border px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <label htmlFor="assistant-question" className="sr-only">
                  Votre question
                </label>
                <input
                  id="assistant-question"
                  ref={inputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={1000}
                  placeholder="Votre question…"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={pending || question.trim().length < MIN_QUESTION_LENGTH}
                  aria-label="Envoyer"
                  className={cn(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-secondary)] text-white transition-opacity",
                    (pending || question.trim().length < MIN_QUESTION_LENGTH) &&
                      "opacity-40",
                  )}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Vos échanges sont conservés 90 jours pour améliorer le service.{" "}
                <Link href="/confidentialite" className="underline underline-offset-2">
                  Confidentialité
                </Link>
              </p>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function toEntry(message: AssistantMessageView): Entry {
  return {
    id: message.id,
    role: message.role,
    text: message.content,
    courses: message.courses,
    offerAdvisor: message.offerAdvisor,
    suggestions: message.suggestions,
  };
}
