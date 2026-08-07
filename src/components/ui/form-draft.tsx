"use client";

// Brouillon automatique d'un formulaire.
//
// Se pose une fois à l'intérieur d'un <form> et s'occupe de tout : il mémorise
// la saisie au fil de la frappe, la restaure à la réouverture, la remet en
// place si l'enregistrement échoue, et l'efface dès qu'il réussit. Aucun
// câblage champ par champ — il travaille sur les éléments nommés du formulaire
// parent, donc ajouter un champ suffit à le faire couvrir.
//
// Deux problèmes distincts, deux restaurations :
//
//  1. L'échec d'enregistrement. React 19 réinitialise le formulaire dès que la
//     Server Action a répondu, y compris quand elle refuse la saisie : les
//     champs reviennent à leur `defaultValue` et tout est à retaper. On les
//     réécrit alors avec le brouillon, plus récent que ces valeurs par
//     construction.
//  2. La sortie non intentionnelle — onglet fermé, lien cliqué, page
//     rafraîchie, session expirée. Là, rien côté serveur ne peut aider : seul
//     un brouillon local survit.

import { useEffect, useRef, useState } from "react";

type DraftField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Champs qu'on ne mémorise jamais, quelle qu'en soit la valeur. */
function isPersistable(el: Element): el is DraftField {
  if (
    !(el instanceof HTMLInputElement) &&
    !(el instanceof HTMLTextAreaElement) &&
    !(el instanceof HTMLSelectElement)
  ) {
    return false;
  }
  if (!el.name) return false;
  if (el instanceof HTMLInputElement) {
    // Un mot de passe n'a rien à faire dans le stockage du navigateur ; un
    // champ caché appartient au code, pas à la saisie ; un fichier n'y est de
    // toute façon pas sérialisable.
    if (el.type === "password" || el.type === "file" || el.type === "hidden") {
      return false;
    }
  }
  return true;
}

function draftFields(form: HTMLFormElement): DraftField[] {
  return Array.from(form.elements).filter(isPersistable);
}

// Le stockage peut manquer (navigation privée, quota) ou contenir du JSON
// abîmé. Le brouillon est un confort, jamais une dépendance : chaque accès
// échoue en silence plutôt que de casser la saisie qu'il est censé protéger.

function writeDraft(key: string, form: HTMLFormElement) {
  try {
    const data: Record<string, string> = {};
    for (const el of draftFields(form)) {
      if (el.value !== "") data[el.name] = el.value;
    }
    if (Object.keys(data).length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* rien à faire */
  }
}

function readDraft(key: string): Record<string, string> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

/**
 * Réécrit les champs à partir du brouillon.
 *
 * `overwrite` distingue les deux situations. Au montage on ne remplit que le
 * vide : sur un formulaire de modification, les valeurs venues de la base font
 * autorité et un vieux brouillon ne doit pas les écraser en silence. Après un
 * échec d'enregistrement au contraire, le brouillon EST ce que la personne
 * vient de taper — il prime.
 *
 * Renvoie le nombre de champs déjà remplis dont le brouillon diffère : ceux-là
 * n'ont pas été touchés, et c'est ce qui justifie de proposer la restauration
 * au lieu de l'imposer.
 */
function restoreDraft(key: string, form: HTMLFormElement, overwrite: boolean) {
  const saved = readDraft(key);
  if (!saved) return 0;
  let conflicts = 0;
  for (const el of draftFields(form)) {
    const value = saved[el.name];
    if (value === undefined) continue;
    if (overwrite || el.value === "") el.value = value;
    else if (el.value !== value) conflicts += 1;
  }
  return conflicts;
}

function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* rien à faire */
  }
}

export function FormDraft({
  /** Identifie le brouillon. Un par écran : `societe:nouvelle`, `compte:nouveau`… */
  storageKey,
  /** Passer `true` quand l'enregistrement a réussi : le brouillon est effacé. */
  clearWhen = false,
  /**
   * Résultat de la Server Action (le `state` de `useActionState`).
   *
   * Sert uniquement de signal : à chaque réponse du serveur son identité
   * change, ce qui déclenche l'effacement (si `clearWhen`) ou la restauration.
   * Le contenu n'est jamais lu.
   */
  signal,
}: {
  storageKey: string;
  clearWhen?: boolean;
  signal?: unknown;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // Dernière réponse traitée. Initialisée à celle du premier rendu : au
  // montage il n'y a rien à réécrire, et un simple drapeau « déjà passé » ne
  // suffirait pas — en mode strict, React rejoue les effets, ce qui le
  // consommerait à vide et ferait passer le montage pour une réponse.
  const lastSignalRef = useRef<unknown>(signal);
  // Brouillon retrouvé qui contredit des champs déjà remplis : on le propose
  // au lieu de l'appliquer.
  const [offer, setOffer] = useState(false);

  const key = `crm-brouillon:${storageKey}`;

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    formRef.current = form;

    // `localStorage` n'est lisible qu'après le rendu : ce drapeau ne peut pas
    // se dériver au rendu, il se pose ici.
    setOffer(restoreDraft(key, form, false) > 0);

    let timer: ReturnType<typeof setTimeout> | null = null;
    // Débounce : écrire à chaque frappe ferait un accès au stockage par
    // caractère.
    const scheduleWrite = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => writeDraft(key, form), 400);
    };
    // À l'envoi, on écrit tout de suite : sans ça, une soumission plus rapide
    // que le débounce laisserait un brouillon amputé des derniers caractères —
    // exactement ceux qu'on restaurerait en cas d'échec.
    const flush = () => {
      if (timer) clearTimeout(timer);
      writeDraft(key, form);
    };

    form.addEventListener("input", scheduleWrite);
    form.addEventListener("change", scheduleWrite);
    form.addEventListener("submit", flush);

    return () => {
      if (timer) clearTimeout(timer);
      form.removeEventListener("input", scheduleWrite);
      form.removeEventListener("change", scheduleWrite);
      form.removeEventListener("submit", flush);
      formRef.current = null;
    };
  }, [key]);

  useEffect(() => {
    if (signal === lastSignalRef.current) return;
    lastSignalRef.current = signal;
    const form = formRef.current;
    if (!form) return;
    if (clearWhen) clearDraft(key);
    else restoreDraft(key, form, true);
    // `signal` est volontairement la seule dépendance : c'est l'arrivée d'une
    // nouvelle réponse qui doit déclencher, pas une re-render quelconque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);

  if (!offer) return <span ref={anchorRef} hidden aria-hidden="true" />;

  // Cas d'une fiche déjà remplie — modification d'une société, d'un cours —
  // dont on retrouve un brouillon divergent. L'appliquer d'office afficherait
  // autre chose que ce qui est enregistré, sans que personne ne l'ait demandé.
  // On propose donc, et on laisse le choix visible tant qu'il n'est pas fait.
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--brand-warning)]/40 bg-[color:var(--brand-warning)]/10 px-3 py-2 text-sm"
    >
      <span ref={anchorRef} className="text-foreground">
        Une saisie non enregistrée a été retrouvée sur ce formulaire.
      </span>
      <button
        type="button"
        className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
        onClick={() => {
          const form = formRef.current;
          if (form) restoreDraft(key, form, true);
          setOffer(false);
        }}
      >
        Restaurer
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs text-muted-foreground underline hover:text-foreground"
        onClick={() => {
          clearDraft(key);
          setOffer(false);
        }}
      >
        Ignorer
      </button>
    </div>
  );
}
