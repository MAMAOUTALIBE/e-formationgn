"use client";

import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  ADMIN_TEXT_SCALE_OPTIONS,
  DEFAULT_ADMIN_TEXT_SCALE,
  isHexColor,
  mutedTextOn,
  readableTextOn,
  type AdminTextScale,
  type AdminThemeColors,
} from "@/lib/admin/theme";
import { updateAdminUiTheme } from "@/server/actions/admin-theme";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

/** Défauts de la charte, affichés quand aucune couleur n'est choisie. */
const DEFAULT_BG = "#ffffff";

interface SurfaceConfig {
  key: "sidebarBg" | "headerBg" | "footerBg";
  label: string;
  hint: string;
}

const SURFACES: SurfaceConfig[] = [
  { key: "sidebarBg", label: "Barre latérale", hint: "Le menu de navigation à gauche." },
  { key: "headerBg", label: "En-tête", hint: "La barre du haut : logo, recherche, avatar." },
  { key: "footerBg", label: "Pied de page", hint: "La bande d'informations en bas." },
];

/** Quelques teintes qui fonctionnent bien en fond de coquille. */
const PRESETS = [
  { label: "Blanc", value: "#ffffff" },
  { label: "Gris clair", value: "#f1f5f9" },
  { label: "Bleu marine", value: "#1e3a8a" },
  { label: "Ardoise", value: "#0f172a" },
  { label: "Vert profond", value: "#065f46" },
  { label: "Bordeaux", value: "#7f1d1d" },
];

export function AdminThemeForm({
  current,
  currentTextScale,
}: {
  current: AdminThemeColors;
  currentTextScale: AdminTextScale;
}) {
  const [state, formAction] = useActionState(updateAdminUiTheme, initialState);
  const errors = state.fieldErrors ?? {};

  // État local pour l'aperçu : il doit réagir à la frappe, avant tout envoi.
  const [values, setValues] = useState<Record<string, string>>({
    sidebarBg: current.sidebar ?? "",
    headerBg: current.header ?? "",
    footerBg: current.footer ?? "",
  });
  const [textScale, setTextScale] = useState<AdminTextScale>(currentTextScale);

  const set = (key: string, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">
          Taille du texte
        </legend>
        <p className="text-xs text-muted-foreground">
          S&apos;applique à tout le CRM. Le site public garde sa propre échelle.
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ADMIN_TEXT_SCALE_OPTIONS.map((option) => {
            const active = textScale === option.value;
            return (
              <label
                key={option.value}
                className={`cursor-pointer rounded-md border p-3 transition-colors ${
                  active
                    ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)]/8"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="textScale"
                    value={option.value}
                    checked={active}
                    onChange={() => setTextScale(option.value)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {option.label}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {option.hint}
                </span>
              </label>
            );
          })}
        </div>

        {/* Aperçu réel : l'attribut data-admin-text sur ce bloc y applique
            l'échelle choisie, exactement comme le layout l'applique au CRM.
            Annoncer « 15 px » ne dit rien tant qu'on ne l'a pas sous les yeux. */}
        <div
          data-admin-text={textScale}
          className="rounded-md border border-border bg-card p-4"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Aperçu — {ADMIN_TEXT_SCALE_OPTIONS.find((o) => o.value === textScale)?.label}
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            Fiche de Awa Diallo
          </p>
          <p className="text-sm text-foreground">
            3 formations attribuées · dernière connexion il y a 2 jours
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Libellé secondaire, comme sous les compteurs du tableau de bord.
          </p>
        </div>
      </fieldset>

      <div className="grid gap-5 lg:grid-cols-3">
        {SURFACES.map((surface) => {
          const value = values[surface.key] ?? "";
          const valid = value === "" || isHexColor(value);
          const preview = valid && value !== "" ? value : DEFAULT_BG;

          return (
            <div key={surface.key} className="space-y-2">
              <label
                htmlFor={surface.key}
                className="block text-sm font-medium text-foreground"
              >
                {surface.label}
              </label>
              <p className="text-xs text-muted-foreground">{surface.hint}</p>

              <div className="flex items-center gap-2">
                {/* Sélecteur natif : pas de dépendance, et il ouvre la palette
                    système que l'utilisateur connaît déjà. */}
                <input
                  type="color"
                  aria-label={`Choisir la couleur — ${surface.label}`}
                  value={isHexColor(value) ? value : DEFAULT_BG}
                  onChange={(e) => set(surface.key, e.target.value)}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1"
                />
                {/* Le champ texte est la valeur réellement soumise : il permet
                    de coller un hex précis et de vider pour revenir au défaut. */}
                <input
                  id={surface.key}
                  name={surface.key}
                  value={value}
                  onChange={(e) => set(surface.key, e.target.value)}
                  placeholder="Par défaut"
                  spellCheck={false}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground"
                />
              </div>

              {!valid ? (
                <p className="text-xs text-[color:var(--brand-danger)]">
                  Format attendu : #1E3A8A
                </p>
              ) : null}
              {errors[surface.key]?.[0] ? (
                <p className="text-xs text-[color:var(--brand-danger)]">
                  {errors[surface.key][0]}
                </p>
              ) : null}

              {/* Aperçu du contraste réellement appliqué : la couleur de texte
                  est calculée, pas choisie — c'est ce que verra l'admin. */}
              <div
                className="rounded-md border border-border p-3 text-sm"
                style={{
                  backgroundColor: preview,
                  color: readableTextOn(preview),
                }}
              >
                <span className="font-medium">Aperçu</span>
                <span
                  className="ml-2 text-xs"
                  style={{ color: mutedTextOn(preview) }}
                >
                  texte secondaire
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => set(surface.key, p.value)}
                    title={p.label}
                    aria-label={`${surface.label} — ${p.label}`}
                    className="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110"
                    style={{ backgroundColor: p.value }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => set(surface.key, "")}
                  className="rounded-full border border-border px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Défaut
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>Enregistrer l&apos;apparence</SubmitButton>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setValues({ sidebarBg: "", headerBg: "", footerBg: "" });
            setTextScale(DEFAULT_ADMIN_TEXT_SCALE);
          }}
        >
          Tout remettre par défaut
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        La couleur du texte n&apos;est pas réglable : elle est calculée à partir de
        la luminance du fond, pour rester lisible quelle que soit la teinte
        choisie. Un champ vide rétablit la couleur par défaut de la charte.
      </p>
    </form>
  );
}
