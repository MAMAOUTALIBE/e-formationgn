"use client";

import { Bot, CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MarkdownContent } from "@/components/features/learning/markdown-content";
import type { ContactAssistantLeadInput } from "@/lib/assistant/contact-prospect";
import { cn } from "@/lib/utils";
import {
  askAssistant,
  submitContactAssistantLead,
} from "@/server/actions/assistant";

type Answers = Omit<ContactAssistantLeadInput, "consent">;
type FieldStep = keyof Answers;
type Step = FieldStep | "consent" | "done" | "declined";

interface ChatMessage {
  id: string;
  role: "assistant" | "visitor";
  text: string;
}

interface ContactAssistantProps {
  assistantAvailable: boolean;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text:
      "Bonjour, je suis **Aiduca-IA**. Décrivez-moi votre projet de formation : je vais d'abord comprendre votre besoin, puis recueillir les informations utiles pour qu'un conseiller vous recontacte.",
  },
];

const QUESTIONS: Record<FieldStep, string> = {
  need: "Quel est votre besoin de formation ?",
  name: "Merci. Quel est votre nom ?",
  company: "Pour quelle entreprise faites-vous cette demande ?",
  phone: "À quel numéro un conseiller peut-il vous joindre ?",
  email: "Quelle est votre adresse e-mail ?",
  training: "Quelle formation recherchez-vous précisément ?",
  availability: "Quand êtes-vous disponible pour être recontacté ?",
};

const NEXT_STEP: Record<FieldStep, FieldStep | "consent"> = {
  need: "name",
  name: "company",
  company: "phone",
  phone: "email",
  email: "training",
  training: "availability",
  availability: "consent",
};

const PLACEHOLDERS: Record<FieldStep, string> = {
  need: "Ex. Former une équipe à l'intelligence artificielle…",
  name: "Votre nom et prénom",
  company: "Nom de l'entreprise ou « Particulier »",
  phone: "+33 6 00 00 00 00",
  email: "vous@entreprise.fr",
  training: "Ex. Intelligence artificielle appliquée au métier",
  availability: "Ex. Mardi matin ou jeudi après 14 h",
};

const MAX_LENGTH: Record<FieldStep, number> = {
  need: 2000,
  name: 120,
  company: 160,
  phone: 30,
  email: 200,
  training: 300,
  availability: 300,
};

export function ContactAssistant({
  assistantAvailable,
}: ContactAssistantProps) {
  const [step, setStep] = useState<Step>("need");
  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequenceRef = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const followLatestMessage = () => {
      feed.scrollTo({ top: feed.scrollHeight });
    };
    followLatestMessage();

    // Une rotation d'écran ou l'apparition du récapitulatif réduit la hauteur
    // du fil. Le ResizeObserver maintient alors le dernier message visible.
    const observer = new ResizeObserver(followLatestMessage);
    observer.observe(feed);
    return () => observer.disconnect();
  }, [messages, pending]);

  function message(role: ChatMessage["role"], text: string): ChatMessage {
    sequenceRef.current += 1;
    return { id: `contact-chat-${sequenceRef.current}`, role, text };
  }

  async function submitCurrentField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFieldStep(step) || pending) return;

    const value = draft.trim();
    const validationError = validateField(step, value);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setDraft("");
    setAnswers((current) => ({ ...current, [step]: value }));
    setMessages((current) => [...current, message("visitor", value)]);

    if (step === "need") {
      setPending(true);
      let acknowledgement =
        "J'ai bien compris votre demande. Je vais maintenant recueillir quelques informations pour transmettre un dossier clair à un conseiller.";

      if (assistantAvailable) {
        try {
          const result = await askAssistant({ question: value });
          if (result.ok && result.answer?.text) {
            acknowledgement = result.answer.text;
          }
        } catch {
          // La qualification doit continuer même si le modèle est indisponible.
        }
      }

      setMessages((current) => [
        ...current,
        message("assistant", acknowledgement),
        message("assistant", QUESTIONS.name),
      ]);
      setPending(false);
      setStep("name");
      return;
    }

    const next = NEXT_STEP[step];
    setStep(next);
    if (next === "consent") {
      setMessages((current) => [
        ...current,
        message(
          "assistant",
          "Merci. Vérifiez ces informations puis donnez votre accord avant leur transmission à l'équipe Aiduca.",
        ),
      ]);
    } else {
      setMessages((current) => [
        ...current,
        message("assistant", QUESTIONS[next]),
      ]);
    }
  }

  async function consentAndSend() {
    if (pending) return;
    const complete = completeAnswers(answers);
    if (!complete) {
      setError("Certaines informations manquent. Recommencez la conversation.");
      return;
    }

    setPending(true);
    setError(null);
    setMessages((current) => [
      ...current,
      message(
        "visitor",
        "Oui, j'accepte que ces informations soient utilisées pour me recontacter.",
      ),
    ]);

    try {
      const result = await submitContactAssistantLead({
        ...complete,
        consent: true,
      });
      if (!result.ok) {
        setError(result.message ?? "L'envoi n'a pas abouti.");
        return;
      }

      setStep("done");
      setMessages((current) => [
        ...current,
        message("assistant", result.message ?? "Votre demande a bien été transmise."),
      ]);
    } catch {
      setError("L'envoi n'a pas abouti. Réessayez dans quelques instants.");
    } finally {
      setPending(false);
    }
  }

  function decline() {
    if (pending) return;
    setStep("declined");
    setError(null);
    setMessages((current) => [
      ...current,
      message("visitor", "Non, je ne souhaite pas transmettre mes informations."),
      message(
        "assistant",
        "Aucune information n'a été envoyée au CRM. Vous pouvez recommencer si vous changez d'avis.",
      ),
    ]);
  }

  function restart() {
    setStep("need");
    setDraft("");
    setAnswers({});
    setMessages(INITIAL_MESSAGES);
    setError(null);
    setPending(false);
  }

  const activeField = isFieldStep(step) ? step : null;

  return (
    <section
      data-testid="contact-assistant"
      aria-labelledby="contact-assistant-title"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-[color:var(--brand-primary)] px-3 py-2.5 text-white sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
            <Bot className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="contact-assistant-title" className="text-sm font-semibold">
              Aiduca-IA
            </h2>
            <p className="text-[11px] leading-4 text-white/75">
              Assistant de qualification
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-white/80">
          <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden />
          En ligne
        </span>
      </header>

      <div
        ref={feedRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-muted/20 px-3 py-3 sm:px-4"
      >
        {messages.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "w-fit max-w-[94%] rounded-xl px-3 py-2 text-sm leading-5 [&>div]:!space-y-2 [&_li]:!text-sm [&_li]:!leading-5 [&_p]:!text-sm [&_p]:!leading-5",
              entry.role === "visitor"
                ? "ml-auto rounded-br-sm bg-[color:var(--brand-secondary)] text-white"
                : "rounded-bl-sm border border-border bg-background text-foreground",
            )}
          >
            {entry.role === "assistant" ? (
              <MarkdownContent source={entry.text} />
            ) : (
              <p className="whitespace-pre-wrap">{entry.text}</p>
            )}
          </div>
        ))}

        {pending ? (
          <p className="flex w-fit items-center gap-2 rounded-xl rounded-bl-sm border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {step === "need" ? "Aiduca-IA analyse votre besoin…" : "Transmission…"}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border px-3 py-2.5 sm:px-4">
        {activeField ? (
          <form onSubmit={submitCurrentField} className="space-y-2" noValidate>
            <label
              htmlFor={`contact-assistant-${activeField}`}
              className="block text-xs font-medium text-foreground sm:text-sm"
            >
              {QUESTIONS[activeField]}
            </label>
            <div className="flex items-end gap-2">
              {activeField === "need" || activeField === "availability" ? (
                <textarea
                  id={`contact-assistant-${activeField}`}
                  data-testid="contact-assistant-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  maxLength={MAX_LENGTH[activeField]}
                  placeholder={PLACEHOLDERS[activeField]}
                  autoFocus
                  disabled={pending}
                  className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-base leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:text-sm"
                />
              ) : (
                <input
                  id={`contact-assistant-${activeField}`}
                  data-testid="contact-assistant-input"
                  type={
                    activeField === "email"
                      ? "email"
                      : activeField === "phone"
                        ? "tel"
                        : "text"
                  }
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={MAX_LENGTH[activeField]}
                  placeholder={PLACEHOLDERS[activeField]}
                  autoComplete={autoCompleteFor(activeField)}
                  autoFocus
                  disabled={pending}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-base leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:text-sm"
                />
              )}
              <button
                type="submit"
                aria-label="Continuer"
                disabled={pending || draft.trim().length === 0}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-secondary)] text-white transition-opacity disabled:opacity-40"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            {activeField === "company" ? (
              <button
                type="button"
                onClick={() => setDraft("Particulier")}
                className="text-xs font-medium text-[color:var(--brand-secondary)] underline underline-offset-4"
              >
                Je fais cette demande à titre particulier
              </button>
            ) : null}
          </form>
        ) : null}

        {step === "consent" ? (
          <div data-testid="contact-assistant-consent" className="space-y-2">
            <Review answers={answers} />
            <div className="rounded-xl border border-[color:var(--brand-secondary)]/25 bg-[color:var(--brand-secondary)]/5 p-3">
              <p className="flex items-start gap-2 text-xs leading-5 text-foreground">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-secondary)]"
                  aria-hidden
                />
                J&apos;accepte qu&apos;Aiduca conserve ces informations et les
                utilise pour me recontacter au sujet de cette demande.
              </p>
              <p className="mt-1 pl-6 text-[11px] leading-4 text-muted-foreground">
                Consultez notre{" "}
                <Link href="/confidentialite" className="underline underline-offset-2">
                  politique de confidentialité
                </Link>
                .
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void consentAndSend()}
                disabled={pending}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[color:var(--brand-secondary)] px-2 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                )}
                Oui, j&apos;accepte et j&apos;envoie
              </button>
              <button
                type="button"
                onClick={decline}
                disabled={pending}
                className="min-h-10 rounded-xl border border-border px-2 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Non, ne rien envoyer
              </button>
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-800 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            Votre demande est enregistrée dans notre liste de prospection.
          </p>
        ) : null}

        {step === "declined" ? (
          <button
            type="button"
            onClick={restart}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Recommencer la conversation
          </button>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        {activeField ? (
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            Aucune donnée n&apos;est envoyée à la prospection avant votre accord.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Review({ answers }: { answers: Partial<Answers> }) {
  const rows = [
    ["Besoin", answers.need],
    ["Nom", answers.name],
    ["Entreprise", answers.company],
    ["Téléphone", answers.phone],
    ["E-mail", answers.email],
    ["Formation", answers.training],
    ["Disponibilité", answers.availability],
  ];

  return (
    <dl className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-x-2 gap-y-1 rounded-xl border border-border bg-muted/20 p-2 text-xs leading-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-medium text-muted-foreground">{label}</dt>
          <dd className="break-words text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function isFieldStep(step: Step): step is FieldStep {
  return step in QUESTIONS;
}

function validateField(step: FieldStep, value: string): string | null {
  if (value.length === 0) return "Ce champ est obligatoire.";
  if (step === "need" && value.length < 5) {
    return "Décrivez votre besoin en quelques mots.";
  }
  if ((step === "name" || step === "company" || step === "training") && value.length < 2) {
    return "Cette réponse est trop courte.";
  }
  if (step === "phone") {
    if (!/^[0-9+(). \t-]+$/.test(value) || value.replace(/\D/g, "").length < 6) {
      return "Indiquez un numéro de téléphone complet.";
    }
  }
  if (step === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Indiquez une adresse e-mail valide.";
  }
  return null;
}

function completeAnswers(answers: Partial<Answers>): Answers | null {
  if (
    !answers.need ||
    !answers.name ||
    !answers.company ||
    !answers.phone ||
    !answers.email ||
    !answers.training ||
    !answers.availability
  ) {
    return null;
  }
  return {
    need: answers.need,
    name: answers.name,
    company: answers.company,
    phone: answers.phone,
    email: answers.email,
    training: answers.training,
    availability: answers.availability,
  };
}

function autoCompleteFor(step: FieldStep): string | undefined {
  if (step === "name") return "name";
  if (step === "company") return "organization";
  if (step === "phone") return "tel";
  if (step === "email") return "email";
  return undefined;
}
