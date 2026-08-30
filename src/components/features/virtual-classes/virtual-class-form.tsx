"use client";

import { Radio } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import {
  createVirtualClass,
  updateVirtualClass,
  type VirtualClassActionResult,
} from "@/server/actions/virtual-classes";

interface Option {
  id: string;
  label: string;
}

interface Values {
  title: string;
  description?: string | null;
  agenda?: string | null;
  trainingSessionId: string;
  instructorId: string;
  startsAt: string;
  durationMinutes: number;
  timezone: string;
  maxParticipants?: number | null;
  earlyJoinMinutes: number;
  recordingEnabled: boolean;
  status: "DRAFT" | "SCHEDULED";
}

const initialState: VirtualClassActionResult = { success: false };

export function VirtualClassForm({
  values,
  sessions,
  instructors,
  virtualClassId,
}: {
  values: Values;
  sessions: Option[];
  instructors: Option[];
  virtualClassId?: string;
}) {
  const router = useRouter();
  const action = virtualClassId ? updateVirtualClass.bind(null, virtualClassId) : createVirtualClass;
  const [state, formAction] = useActionState(action, initialState);
  useEffect(() => {
    if (state.success && state.virtualClassId) {
      router.push(`/admin/classes-virtuelles/${state.virtualClassId}`);
      router.refresh();
    }
  }, [router, state.success, state.virtualClassId]);
  const sent = state.values;
  const value = (key: keyof Values) => sent?.[key] ?? values[key] ?? "";
  const error = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      {state.message ? (
        <p role="status" className={state.success ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <FormField id="title" label="Titre" required error={error("title")}>
          <Input id="title" name="title" defaultValue={String(value("title"))} maxLength={180} required />
        </FormField>
        <FormField id="status" label="Statut" required error={error("status")}>
          <Select id="status" name="status" defaultValue={String(value("status"))}>
            <option value="DRAFT">Brouillon</option>
            <option value="SCHEDULED">Programmée</option>
          </Select>
        </FormField>
      </div>
      <FormField id="description" label="Description" error={error("description")}>
        <Textarea id="description" name="description" defaultValue={String(value("description"))} rows={3} />
      </FormField>
      <FormField id="agenda" label="Programme" error={error("agenda")}>
        <Textarea id="agenda" name="agenda" defaultValue={String(value("agenda"))} rows={5} />
      </FormField>
      <div className="grid gap-4 lg:grid-cols-2">
        <FormField id="trainingSessionId" label="Formation et session" required error={error("trainingSessionId")}>
          <Select id="trainingSessionId" name="trainingSessionId" defaultValue={String(value("trainingSessionId"))} required>
            <option value="">Sélectionner une session</option>
            {sessions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
        </FormField>
        <FormField id="instructorId" label="Formateur" required error={error("instructorId")}>
          <Select id="instructorId" name="instructorId" defaultValue={String(value("instructorId"))} required>
            <option value="">Sélectionner un formateur</option>
            {instructors.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FormField id="startsAt" label="Date et heure" required error={error("startsAt")}>
          <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={String(value("startsAt"))} required />
        </FormField>
        <FormField id="durationMinutes" label="Durée (minutes)" required error={error("durationMinutes")}>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={15} max={480} defaultValue={String(value("durationMinutes"))} required />
        </FormField>
        <FormField id="timezone" label="Fuseau horaire" required error={error("timezone")}>
          <Input id="timezone" name="timezone" defaultValue={String(value("timezone"))} required />
        </FormField>
        <FormField id="maxParticipants" label="Participants maximum" hint="Vide = limite de la session." error={error("maxParticipants")}>
          <Input id="maxParticipants" name="maxParticipants" type="number" min={2} max={500} defaultValue={String(value("maxParticipants"))} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="earlyJoinMinutes" label="Ouverture anticipée (minutes)" error={error("earlyJoinMinutes")}>
          <Input id="earlyJoinMinutes" name="earlyJoinMinutes" type="number" min={0} max={120} defaultValue={String(value("earlyJoinMinutes"))} />
        </FormField>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm">
          <Checkbox name="recordingEnabled" defaultChecked={Boolean(value("recordingEnabled"))} />
          Autoriser l’enregistrement après confirmation visible
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <SubmitButton>{virtualClassId ? "Enregistrer les modifications" : "Créer la classe virtuelle"}</SubmitButton>
        {!virtualClassId ? (
          <SubmitButton
            name="intent"
            value="OPEN_NOW"
            variant="secondary"
            formNoValidate
            pendingLabel="Ouverture en cours…"
          >
            <Radio className="h-4 w-4" />
            Créer et ouvrir maintenant
          </SubmitButton>
        ) : null}
      </div>
      {!virtualClassId ? (
        <p className="text-xs text-muted-foreground">
          L’ouverture immédiate utilise la durée indiquée et remplace la date de début par l’heure actuelle.
        </p>
      ) : null}
    </form>
  );
}
