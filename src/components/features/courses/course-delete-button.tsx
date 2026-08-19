"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { adminDeleteCourse } from "@/server/actions/admin-courses";
import { deleteCourse } from "@/server/actions/instructor";

interface CourseDeleteButtonProps {
  courseId: string;
  courseTitle: string;
  /** "instructor" appelle deleteCourse (propriétaire), "admin" appelle adminDeleteCourse. */
  mode: "instructor" | "admin";
  /** Faux si le cours a des ventes/certificats → suppression définitive impossible. */
  deletable: boolean;
  enrollments: number;
  /** Affichage compact dans un menu d’actions, sans changer la confirmation. */
  presentation?: "button" | "menu-item";
}

export function CourseDeleteButton({
  courseId,
  courseTitle,
  mode,
  deletable,
  enrollments,
  presentation = "button",
}: CourseDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    startTransition(async () => {
      setError(null);
      // deleteCourse (formateur) redirige côté serveur en cas de succès ;
      // adminDeleteCourse renvoie un ActionResult et on navigue ici.
      const res =
        mode === "admin"
          ? await adminDeleteCourse(courseId)
          : await deleteCourse(courseId);
      if (res && !res.success) {
        setError(res.message ?? "Échec de la suppression.");
        return;
      }
      setOpen(false);
      if (mode === "admin") router.push("/admin/cours");
    });
  }

  return (
    <div className="space-y-2">
      {!deletable ? (
        <p className="text-xs text-muted-foreground">
          Suppression définitive impossible : cette formation a des ventes ou des
          certificats. Archivez-le pour le retirer du catalogue tout en
          préservant la comptabilité.
        </p>
      ) : null}

      <Button
        type="button"
        variant={presentation === "menu-item" ? "ghost" : "outline"}
        role={presentation === "menu-item" ? "menuitem" : undefined}
        disabled={!deletable || pending}
        onClick={() => setOpen(true)}
        title={!deletable ? "Suppression indisponible pour cette formation" : undefined}
        className={
          presentation === "menu-item"
            ? "h-9 w-full justify-start px-2 text-[color:var(--brand-danger)] hover:bg-[color:var(--brand-danger)]/10"
            : "border-[color:var(--brand-danger)]/40 text-[color:var(--brand-danger)] hover:bg-[color:var(--brand-danger)]/10"
        }
      >
        <Trash2 className="h-4 w-4" />
        Supprimer la formation
      </Button>

      {error ? (
        <p className="text-xs text-[color:var(--brand-danger)]">{error}</p>
      ) : null}

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Supprimer « ${courseTitle} » ?`}
        description={`Action irréversible.${
          enrollments > 0
            ? ` ${enrollments.toLocaleString("fr-FR")} inscription(s) seront aussi supprimées.`
            : ""
        } La formation, ses sections, leçons, quiz et avis seront définitivement effacés.`}
        confirmLabel="Supprimer définitivement"
        destructive
        pending={pending}
        onConfirm={confirm}
      />
    </div>
  );
}
