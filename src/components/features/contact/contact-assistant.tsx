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
    feed.scrollTo({ top: feed.scrollHeight });
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
      className="overflow-hidden rounded-3xl border border-border bg-background shadow-sm"
    >
      <header className="flex items-center justify-between gap-4 border-b border-border bg-[color:var(--brand-primary)] px-5 py-4 text-white sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
            <Bot className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="contact-assistant-title" className="font-semibold">
              Aiduca-IA
            </h2>
            <p className="text-xs text-white/75">Assistant de qualification</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-white/80">
          <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden />
          En ligne
        </span>
      </header>

      <div
        ref={feedRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="max-h-[32rem] min-h-80 space-y-4 overflow-y-auto bg-muted/20 px-4 py-5 sm:px-6"
      >
        {messages.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "w-fit max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6",
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
          <p className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {step === "need" ? "Aiduca-IA analyse votre besoin…" : "Transmission…"}
          </p>
        ) : null}
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-6">
        {activeField ? (
          <form onSubmit={submitCurrentField} className="space-y-3" noValidate>
            <label
              htmlFor={`contact-assistant-${activeField}`}
              className="block text-sm font-medium text-foreground"
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
                  rows={activeField === "need" ? 3 : 2}
                  maxLength={MAX_LENGTH[activeField]}
                  placeholder={PLACEHOLDERS[activeField]}
                  autoFocus
                  disabled={pending}
                  className="min-w-0 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:text-sm"
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
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:text-sm"
                />
              )}
              <button
                type="submit"
                aria-label="Continuer"
                disabled={pending || draft.trim().length === 0}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--brand-secondary)] text-white transition-opacity disabled:opacity-40"
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
                className="text-sm font-medium text-[color:var(--brand-secondary)] underline underline-offset-4"
              >
                Je fais cette demande à titre particulier
              </button>
            ) : null}
          </form>
        ) : null}

        {step === "consent" ? (
          <div data-testid="contact-assistant-consent" className="space-y-4">
            <Review answers={answers} />
            <div className="rounded-2xl border border-[color:var(--brand-secondary)]/25 bg-[color:var(--brand-secondary)]/5 p-4">
              <p className="flex items-start gap-2 text-sm leading-6 text-foreground">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-secondary)]"
                  aria-hidden
                />
                J&apos;accepte qu&apos;Aiduca conserve ces informations et les
                utilise pour me recontacter au sujet de cette demande.
              </p>
              <p className="mt-2 pl-7 text-xs leading-5 text-muted-foreground">
                Consultez notre{" "}
                <Link href="/confidentialite" className="underline underline-offset-2">
                  politique de confidentialité
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void consentAndSend()}
                disabled={pending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--brand-secondary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
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
                className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Non, ne rien envoyer
              </button>
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-800 dark:text-emerald-200"
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

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Aucune donnée n&apos;est envoyée à la prospection avant votre accord.
        </p>
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
    <dl className="grid gap-2 rounded-2xl border border-border bg-muted/20 p-4 text-sm sm:grid-cols-[8rem_1fr]">
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
