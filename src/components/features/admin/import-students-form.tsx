"use client";

import { useActionState, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { MAX_IMPORT_ROWS } from "@/lib/admin/csv-students";
import {
  importStudents,
  type ImportStudentsResult,
} from "@/server/actions/admin-import-students";

const initialState: ImportStudentsResult = { success: false };

const PLACEHOLDER = `Prénom;Nom;Email
Awa;Diallo;awa.diallo@exemple.gn
Mamadou;Bah;mamadou.bah@exemple.gn`;

export function ImportStudentsForm({
  courses,
}: {
  courses: Array<{ id: string; title: string }>;
}) {
  const [state, formAction] = useActionState(importStudents, initialState);
  const [csv, setCsv] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Le fichier est lu côté navigateur et versé dans le champ texte : l'admin
  // voit ce qui part avant d'envoyer, et l'action serveur ne reçoit qu'une
  // chaîne — pas de gestion de fichier multipart pour trois colonnes.
  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  };

  /** Télécharge les identifiants générés, pour un publipostage. */
  const downloadCredentials = () => {
    if (!state.created?.length) return;
    const lines = [
      "Prénom;Nom;Email;Mot de passe",
      ...state.created.map((c) => `${c.firstName};${c.lastName};${c.email};${c.password}`),
    ].join("\n");
    // BOM : sans lui, Excel affiche les accents en caractères parasites.
    const blob = new Blob([`﻿${lines}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "identifiants.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {state.created?.length ? (
        <Alert variant="success">
          <AlertDescription>
            <p className="font-medium">{state.message}</p>
            {state.grantedCourses?.length ? (
              <p className="mt-1 text-sm">
                Formations ouvertes : {state.grantedCourses.join(", ")}.
              </p>
            ) : null}
            <p className="mt-2 text-sm">
              Ces mots de passe ne seront plus affichés — récupérez-les
              maintenant.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={downloadCredentials}
            >
              Télécharger les identifiants (CSV)
            </Button>
            <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-border bg-background">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Email</th>
                    <th className="px-2 py-1.5 font-medium">Mot de passe</th>
                  </tr>
                </thead>
                <tbody>
                  {state.created.map((c) => (
                    <tr key={c.email} className="border-t border-border">
                      <td className="px-2 py-1.5">{c.email}</td>
                      <td className="px-2 py-1.5 font-mono">{c.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {!state.success && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.skipped?.length ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium">
              {state.skipped.length} ligne{state.skipped.length > 1 ? "s" : ""} ignorée
              {state.skipped.length > 1 ? "s" : ""}
            </p>
            <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
              {state.skipped.map((s, i) => (
                <li key={`${s.line}-${i}`}>
                  Ligne {s.line} — {s.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="csv" className="block text-sm font-medium text-foreground">
            Liste des élèves
          </label>
          <p className="text-xs text-muted-foreground">
            Trois colonnes : prénom, nom, email — plus « formateur » en 4ᵉ colonne
            pour créer un compte formateur. Point-virgule, virgule ou tabulation,
            avec ou sans ligne d&apos;en-tête. Maximum {MAX_IMPORT_ROWS} lignes par
            envoi.
          </p>
          <textarea
            id="csv"
            name="csv"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={7}
            spellCheck={false}
            className="w-full rounded-md border border-border bg-background p-3 font-mono text-sm text-foreground"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Charger un fichier CSV
            </Button>
            {csv ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setCsv("")}>
                Vider
              </Button>
            ) : null}
          </div>
        </div>

        {courses.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Ouvrir ces formations à tous les comptes créés (facultatif)
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {courses.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input type="checkbox" name="courseIds" value={c.id} className="h-4 w-4" />
                  <span className="truncate text-foreground">{c.title}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <SubmitButton disabled={csv.trim() === ""}>
          Importer la promotion
        </SubmitButton>
        <p className="text-xs text-muted-foreground">
          Le chiffrement de chaque mot de passe prend environ 300 ms : comptez une
          quinzaine de secondes pour {MAX_IMPORT_ROWS} comptes. Ne fermez pas la
          page pendant l&apos;import.
        </p>
      </form>
    </div>
  );
}
