"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import {
  setInternalNotesOnCourse,
  toggleFeaturedCourse,
} from "@/server/actions/admin-courses";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

async function setFeatured(_previous: ActionResult, formData: FormData) {
  return toggleFeaturedCourse(
    String(formData.get("courseId") ?? ""),
    formData.get("featured") === "true",
  );
}

async function saveNotes(_previous: ActionResult, formData: FormData) {
  return setInternalNotesOnCourse(
    String(formData.get("courseId") ?? ""),
    String(formData.get("notes") ?? ""),
  );
}

export function CourseManagementPanel({
  courseId,
  isFeatured,
  notes,
}: {
  courseId: string;
  isFeatured: boolean;
  notes: string;
}) {
  const [featuredState, featuredAction] = useActionState(setFeatured, initialState);
  const [notesState, notesAction] = useActionState(saveNotes, initialState);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 px-4 pb-2 pt-3">
        <CardTitle className="text-base">Gestion</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 pb-2.5">
        <form action={featuredAction} className="shrink-0 space-y-2">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="featured" value={String(!isFeatured)} />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground xl:whitespace-nowrap">Mise en avant</p>
              <p className="truncate text-xs text-muted-foreground">
                {isFeatured ? "Visible dans la sélection éditoriale" : "Pas en vedette"}
              </p>
            </div>
            <SubmitButton variant="outline" size="sm" pendingLabel="Mise à jour…">
              {isFeatured ? "Retirer" : "Mettre en avant"}
            </SubmitButton>
          </div>
          {featuredState.message ? (
            <p
              aria-live="polite"
              className={featuredState.success ? "text-xs text-[color:var(--brand-success)]" : "text-xs text-destructive"}
            >
              {featuredState.message}
            </p>
          ) : null}
        </form>

        <div className="flex min-h-0 flex-1 flex-col border-t border-border pt-2">
          <form action={notesAction} className="flex h-full min-h-0 flex-col gap-2">
            <input type="hidden" name="courseId" value={courseId} />
            <div className="flex shrink-0 items-baseline justify-between gap-2">
              <label htmlFor="course-internal-notes" className="text-sm font-medium text-foreground xl:shrink-0 xl:whitespace-nowrap">
                Notes internes
              </label>
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground xl:text-right">Équipe admin uniquement</p>
            </div>
            <Textarea
              id="course-internal-notes"
              name="notes"
              rows={3}
              defaultValue={notes}
              placeholder="Notes internes…"
              className="flex-1 resize-none xl:!min-h-12"
            />
            {notesState.message ? (
              <Alert variant={notesState.success ? "success" : "destructive"} className="py-2">
                <AlertDescription aria-live="polite" className="text-xs">
                  {notesState.message}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex shrink-0 justify-end">
              <SubmitButton size="sm" pendingLabel="Enregistrement…">
                Enregistrer
              </SubmitButton>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
