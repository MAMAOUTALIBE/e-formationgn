"use client";

// Base documentaire d'Aiduca-IA : liste + éditeur.
//
// Un seul formulaire pour la création et l'édition — comme `CompanyForm`, dont
// on reprend le patron `useActionState` + `action.bind(null, id)`. Deux
// formulaires séparés divergeraient au premier champ ajouté.

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createAssistantDocument,
  deleteAssistantDocument,
  getAssistantDocumentDraft,
  synchronizeAssistantKnowledge,
  updateAssistantDocument,
  type AssistantAdminResult,
} from "@/server/actions/admin-assistant-knowledge";

export interface AssistantDocumentRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  isPublished: boolean;
  position: number;
  sourceLabel: string | null;
  sourceUrl: string | null;
  updatedAt: Date;
  updatedBy: { name: string | null; email: string } | null;
  _count: { chunks: number };
}

export interface AssistantDocumentDraft {
  id?: string;
  slug: string;
  title: string;
  category: string;
  body: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  isPublished: boolean;
  position: number;
}

const EMPTY_DRAFT: AssistantDocumentDraft = {
  slug: "",
  title: "",
  category: "",
  body: "",
  sourceLabel: null,
  sourceUrl: null,
  isPublished: true,
  position: 0,
};

const INITIAL: AssistantAdminResult = { success: false };

interface Props {
  documents: AssistantDocumentRow[];
  categories: string[];
  /** Brouillon pré-rempli, typiquement depuis une question sans réponse. */
  initialDraft?: AssistantDocumentDraft | null;
}

export function AssistantSourcesManager({
  documents,
  categories,
  initialDraft = null,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<AssistantDocumentDraft | null>(initialDraft);
  const [confirming, setConfirming] = useState<AssistantDocumentRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [synchronizing, startSynchronization] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">
            Documents ({documents.length})
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={synchronizing}
              onClick={() => {
                setNotice(null);
                startSynchronization(async () => {
                  const result = await synchronizeAssistantKnowledge();
                  setNotice(result.message ?? null);
                  if (result.success) router.refresh();
                });
              }}
            >
              <RefreshCw
                className={`mr-1 h-4 w-4 ${synchronizing ? "animate-spin" : ""}`}
                aria-hidden
              />
              {synchronizing ? "Synchronisation…" : "Synchroniser le site"}
            </Button>
            <Button size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Nouveau
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notice ? (
            <p role="status" className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm">
              {notice}
            </p>
          ) : null}

          {documents.length === 0 ? (
            <EmptyState
              title="Base documentaire vide"
              description="Sans document, l'assistant ne peut répondre que sur le catalogue. Utilisez « Synchroniser le site » pour l'amorcer depuis les pages publiques."
            />
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {doc.title}
                      </span>
                      <Badge variant={doc.isPublished ? "default" : "secondary"}>
                        {doc.isPublished ? "Publié" : "Brouillon"}
                      </Badge>
                      <Badge variant="outline">{doc.category}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      /{doc.slug} · {doc._count.chunks} fragment
                      {doc._count.chunks > 1 ? "s" : ""} indexé
                      {doc._count.chunks > 1 ? "s" : ""}
                      {doc.updatedBy
                        ? ` · dernière modification par ${doc.updatedBy.name ?? doc.updatedBy.email}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Modifier ${doc.title}`}
                      onClick={() => {
                        setNotice(null);
                        void getAssistantDocumentDraft(doc.id).then(setDraft);
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Supprimer ${doc.title}`}
                      onClick={() => setConfirming(doc)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        {draft ? (
          <DocumentForm
            key={draft.id ?? "new"}
            draft={draft}
            categories={categories}
            onClose={() => setDraft(null)}
            onSaved={(message) => {
              setDraft(null);
              setNotice(message);
              router.refresh();
            }}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Éditeur</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sélectionnez un document à modifier, ou créez-en un nouveau.
                Chaque enregistrement réindexe automatiquement le document pour
                la recherche.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Supprimer ce document ?"
        description={
          confirming
            ? `« ${confirming.title} » et ses fragments seront supprimés. L'assistant cessera immédiatement de s'appuyer dessus.`
            : undefined
        }
        destructive
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (!confirming) return;
          const result = await deleteAssistantDocument(confirming.id);
          setConfirming(null);
          setNotice(result.message ?? null);
          router.refresh();
        }}
      />
    </div>
  );
}

function DocumentForm({
  draft,
  categories,
  onClose,
  onSaved,
}: {
  draft: AssistantDocumentDraft;
  categories: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const action = draft.id
    ? updateAssistantDocument.bind(null, draft.id)
    : createAssistantDocument;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  if (state.success && state.message) {
    // Rendu une seule fois : le parent démonte ce formulaire aussitôt.
    queueMicrotask(() => onSaved(state.message as string));
  }

  const err = (field: string) => state.fieldErrors?.[field];
  const value = (field: keyof AssistantDocumentDraft) =>
    state.values?.[field] ?? String(draft[field] ?? "");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">
          {draft.id ? "Modifier le document" : "Nouveau document"}
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="space-y-4">
          <FormField id="doc-title" label="Titre" error={err("title")} required>
            <Input id="doc-title" name="title" defaultValue={value("title")} required />
          </FormField>

          <FormField
            id="doc-slug"
            label="Identifiant"
            hint="Minuscules, chiffres et tirets. Sert de référence de source."
            error={err("slug")}
            required
          >
            <Input id="doc-slug" name="slug" defaultValue={value("slug")} required />
          </FormField>

          <FormField
            id="doc-category"
            label="Catégorie"
            hint="« Essentiels » est toujours joint au contexte, même sans correspondance de recherche."
            error={err("category")}
            required
          >
            <Input
              id="doc-category"
              name="category"
              list="assistant-categories"
              defaultValue={value("category")}
              required
            />
          </FormField>
          <datalist id="assistant-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <FormField
            id="doc-body"
            label="Contenu"
            hint="Découpé automatiquement en fragments. Un titre de section par ligne, terminé par « : » ou préfixé de « ## »."
            error={err("body")}
            required
          >
            <Textarea
              id="doc-body"
              name="body"
              rows={12}
              defaultValue={value("body")}
              required
            />
          </FormField>

          <FormField
            id="doc-source-label"
            label="Libellé de la source (facultatif)"
            error={err("sourceLabel")}
          >
            <Input
              id="doc-source-label"
              name="sourceLabel"
              defaultValue={value("sourceLabel")}
            />
          </FormField>

          <FormField
            id="doc-source-url"
            label="Page du site (facultatif)"
            hint="Chemin interne, par exemple /aide. Les liens externes sont retirés des réponses."
            error={err("sourceUrl")}
          >
            <Input
              id="doc-source-url"
              name="sourceUrl"
              placeholder="/aide"
              defaultValue={value("sourceUrl")}
            />
          </FormField>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="isPublished"
                defaultChecked={draft.isPublished}
                className="h-4 w-4 rounded border-border"
              />
              Publié
            </label>
            <FormField id="doc-position" label="Ordre" error={err("position")}>
              <Input
                id="doc-position"
                name="position"
                type="number"
                min={0}
                max={9999}
                defaultValue={value("position")}
                className="w-24"
              />
            </FormField>
          </div>

          {state.message && !state.success ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Enregistrement…" : "Enregistrer et réindexer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
