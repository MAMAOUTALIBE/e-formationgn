"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Archive, ArrowDown, ArrowUp, ArrowUpDown, BookOpen, Check,
  ChevronLeft, ChevronRight, Copy, Pencil, Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminActionMenu } from "@/components/ui/admin-action-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CourseStatus } from "@/generated/prisma/enums";
import type { AdminCourseRow, AdminCoursesSort } from "@/server/queries/admin-courses";
import {
  adminDeleteCourse, approveCourse, bulkPublish, bulkUnpublish,
  duplicateCourse, unpublishCourse,
} from "@/server/actions/admin-courses";

type Params = Record<string, string | undefined>;

const courseDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function AdminCoursesTable({ rows, params, page, pageSize, total, totalPages }: {
  rows: AdminCourseRow[];
  params: Params;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminCourseRow | null>(null);
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const href = (changes: Params) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...changes })) {
      if (value) search.set(key, value);
    }
    return `/admin/cours?${search.toString()}`;
  };

  function run(action: () => Promise<{ success: boolean; message?: string }>) {
    startTransition(async () => {
      setMessage(null);
      const result = await action();
      setMessage(result.message ?? (result.success ? "Action terminée." : "Une erreur est survenue."));
      if (result.success) {
        setSelected(new Set());
        setToDelete(null);
        router.refresh();
      }
    });
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pageNumbers = paginationNumbers(page, totalPages);
  const selectedIds = [...selected];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]" aria-busy={pending}>
      {selected.size > 0 ? (
        <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border/70 bg-muted/35 px-3 text-xs">
          <strong>{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</strong>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => bulkPublish(selectedIds))}>
            <Check className="h-3.5 w-3.5" /> Publier
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => bulkUnpublish(selectedIds))}>
            <Archive className="h-3.5 w-3.5" /> Archiver
          </Button>
          <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>Annuler</button>
        </div>
      ) : message ? (
        <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-border/70 bg-muted/35 px-3 text-xs" role="status">
          <span>{message}</span><button type="button" onClick={() => setMessage(null)} aria-label="Fermer">×</button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[68rem] table-fixed text-sm">
          <colgroup><col className="w-12" /><col className="w-[32%]" /><col className="w-32" /><col className="w-[17%]" /><col className="w-[15%]" /><col className="w-24" /><col className="w-36" /><col className="w-16" /></colgroup>
          <thead className="sticky top-0 z-20 border-b border-border bg-card text-left text-[10px] uppercase tracking-[.08em] text-muted-foreground shadow-[0_1px_0_var(--border)]">
            <tr className="h-10">
              <th className="px-4"><Checkbox aria-label="Sélectionner les formations de cette page" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())} /></th>
              <SortableHeader label="Formation" field="title" params={params} />
              <SortableHeader label="Statut" field="status" params={params} />
              <SortableHeader label="Formateur" field="instructor" params={params} />
              <SortableHeader label="Catégorie" field="category" params={params} />
              <SortableHeader label="Élèves" field="enrollments" params={params} align="right" />
              <SortableHeader label="Mis à jour" field="updatedAt" params={params} />
              <th className="px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((course) => (
              <tr key={course.id} className="h-14 transition-colors hover:bg-muted/35 data-[selected=true]:bg-[color:var(--brand-secondary)]/5" data-selected={selected.has(course.id)}>
                <td className="px-4"><Checkbox aria-label={`Sélectionner ${course.title}`} checked={selected.has(course.id)} onChange={() => toggle(course.id)} /></td>
                <td className="px-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-emerald-100 text-blue-700 dark:from-blue-500/20 dark:to-emerald-500/20 dark:text-blue-300"><BookOpen className="h-4 w-4" /></span>
                    <div className="min-w-0"><Link href={`/admin/cours/${course.id}`} title={course.title} className="block truncate font-semibold hover:underline">{course.title}</Link><p title={course.slug} className="truncate text-[10px] text-muted-foreground">{course.slug}</p></div>
                  </div>
                </td>
                <td className="px-3"><CourseStatusBadge status={course.status} /></td>
                <td className="truncate px-3 text-muted-foreground" title={course.instructor.name ?? course.instructor.email}>{course.instructor.name ?? course.instructor.email}</td>
                <td className="truncate px-3 text-muted-foreground" title={course.category.name}>{course.category.name}</td>
                <td className="px-3 text-right font-semibold tabular-nums">{course.totalEnrollments.toLocaleString("fr-FR")}</td>
                <td className="px-3 text-xs text-muted-foreground"><time dateTime={course.updatedAt.toISOString()}>{courseDateFormatter.format(course.updatedAt)}</time></td>
                <td className="px-3 text-right"><CourseMenu course={course} pending={pending} onAction={run} onDelete={() => setToDelete(course)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-t border-border/70 px-4 text-xs text-muted-foreground">
        <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} sur ${total}` : "0 résultat"}</span>
        <div className="flex items-center gap-4">
          <label className="hidden items-center gap-2 sm:flex">Lignes par page<Select aria-label="Lignes par page" value={pageSize} className="h-8 w-20 py-1" onChange={(event) => router.push(href({ pageSize: event.target.value, page: "1" }))}><option value="25">25</option><option value="50">50</option><option value="100">100</option></Select></label>
          <nav className="flex items-center gap-1" aria-label="Pagination des formations">
            <PageLink href={href({ page: String(page - 1) })} disabled={page <= 1} label="Page précédente"><ChevronLeft className="h-4 w-4" /></PageLink>
            {pageNumbers.map((item, index) => item === "…" ? <span key={`ellipsis-${index}`} className="w-8 text-center">…</span> : <Link key={item} href={href({ page: String(item) })} aria-current={item === page ? "page" : undefined} className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-medium ${item === page ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>{item}</Link>)}
            <PageLink href={href({ page: String(page + 1) })} disabled={page >= totalPages} label="Page suivante"><ChevronRight className="h-4 w-4" /></PageLink>
          </nav>
        </div>
      </footer>

      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} title={`Supprimer « ${toDelete?.title ?? "cette formation"} » ?`} description="Cette action est définitive. Une formation liée à des commandes, inscriptions, certificats ou à un programme ne pourra pas être supprimée ; elle devra être archivée." confirmLabel="Supprimer définitivement" destructive pending={pending} onConfirm={() => { if (toDelete) run(() => adminDeleteCourse(toDelete.id)); }} />
    </section>
  );
}

function SortableHeader({ label, field, params, align }: { label: string; field: AdminCoursesSort; params: Params; align?: "right" }) {
  const active = params.sort === field;
  const direction = active && params.direction === "asc" ? "asc" : "desc";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && key !== "page") search.set(key, value);
  search.set("sort", field); search.set("direction", active && direction === "desc" ? "asc" : "desc");
  const Icon = active ? direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
  return <th className={`px-3 ${align === "right" ? "text-right" : ""}`}><Link href={`/admin/cours?${search}`} className={`inline-flex items-center gap-1 hover:text-foreground ${align === "right" ? "justify-end" : ""}`}>{label}<Icon className={`h-3 w-3 ${active ? "text-foreground" : "opacity-40"}`} /></Link></th>;
}

function CourseMenu({ course, pending, onAction, onDelete }: { course: AdminCourseRow; pending: boolean; onAction: (action: () => Promise<{ success: boolean; message?: string }>) => void; onDelete: () => void }) {
  return (
    <AdminActionMenu triggerLabel={`Actions pour ${course.title}`} menuLabel={`Menu d’actions pour ${course.title}`} widthClass="sm:w-52">
      {(close) => <div data-testid="course-actions-menu">
        <p className="border-b border-border px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Actions de la formation
        </p>
        <div className="space-y-0.5 pt-1">
          <MenuLink href={`/admin/cours/${course.id}`} icon={<Pencil className="h-4 w-4" />} onSelect={close}>Modifier</MenuLink>
          {course.status !== "PUBLISHED" ? <MenuButton disabled={pending} icon={<Check className="h-4 w-4" />} onClick={() => { close(); onAction(() => approveCourse(course.id)); }}>Publier</MenuButton> : null}
          <MenuButton disabled={pending} icon={<Copy className="h-4 w-4" />} onClick={() => { close(); onAction(() => duplicateCourse(course.id)); }}>Dupliquer</MenuButton>
          <MenuButton disabled={pending || course.status === "ARCHIVED"} icon={<Archive className="h-4 w-4" />} onClick={() => { close(); onAction(() => unpublishCourse(course.id)); }}>Archiver</MenuButton>
          <MenuButton disabled={pending} danger icon={<Trash2 className="h-4 w-4" />} onClick={() => { close(); onDelete(); }}>Supprimer</MenuButton>
        </div>
      </div>}
    </AdminActionMenu>
  );
}
const MENU_ITEM_CLASS = "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium hover:bg-muted focus:bg-muted focus-visible:bg-muted focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
function MenuLink({ href, icon, children, onSelect }: { href: string; icon: React.ReactNode; children: React.ReactNode; onSelect: () => void }) { return <Link role="menuitem" href={href} onClick={onSelect} className={MENU_ITEM_CLASS}>{icon}{children}</Link>; }
function MenuButton({ icon, children, danger, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode; danger?: boolean }) { return <button role="menuitem" type="button" className={`${MENU_ITEM_CLASS} ${danger ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10" : ""}`} {...props}>{icon}{children}</button>; }
function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) { return disabled ? <span aria-disabled className="flex h-8 w-8 items-center justify-center rounded-md opacity-35">{children}</span> : <Link href={href} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted">{children}</Link>; }
function CourseStatusBadge({ status }: { status: CourseStatus }) { if (status === "PUBLISHED") return <StatusBadge tone="success">Publié</StatusBadge>; if (status === "PENDING_REVIEW") return <StatusBadge tone="warning">À modérer</StatusBadge>; if (status === "REJECTED") return <StatusBadge tone="danger">Rejeté</StatusBadge>; if (status === "ARCHIVED") return <StatusBadge tone="neutral">Archivé</StatusBadge>; return <StatusBadge tone="neutral">Brouillon</StatusBadge>; }
function paginationNumbers(page: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1); const values: Array<number | "…"> = [1]; if (page > 3) values.push("…"); for (let value = Math.max(2, page - 1); value <= Math.min(total - 1, page + 1); value++) values.push(value); if (page < total - 2) values.push("…"); values.push(total); return values; }
