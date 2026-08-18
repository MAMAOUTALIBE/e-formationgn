"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Ban, Building2, Check, ChevronLeft, ChevronRight, EllipsisVertical, Eye, GraduationCap, KeyRound, Pencil, ShieldOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AccountStatus } from "@/generated/prisma/enums";
import { resetCenterAccountPassword } from "@/server/actions/admin-accounts";
import { grantCourseToUsers } from "@/server/actions/admin-enrollments";
import { banUser, bulkAssignCompany, bulkSetUserState, deleteUserGdpr, exportSelectedUsersCsv, reactivateUser, suspendUser } from "@/server/actions/admin-users";
import type { AdminUserRow, AdminUsersSort } from "@/server/queries/admin-users";

type Params = Record<string, string | undefined>;
type ActionResult = { success: boolean; message?: string; temporaryPassword?: string };
type Choice = { id: string; name?: string; title?: string };

const learnerDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
});

export function LearnersTable({ rows, params, page, pageSize, total, totalPages, companies, courses }: {
  rows: AdminUserRow[]; params: Params; page: number; pageSize: number; total: number; totalPages: number;
  companies: Choice[]; courses: Choice[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; action: () => Promise<ActionResult> } | null>(null);
  const [assignment, setAssignment] = useState<{ kind: "company" | "course"; ids: string[] } | null>(null);
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedIds = [...selected];

  const href = (changes: Params) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...changes })) if (value) search.set(key, value);
    return `/admin/utilisateurs?${search}`;
  };
  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      setMessage(null);
      const result = await action();
      setMessage(result.temporaryPassword ? `${result.message} Mot de passe provisoire : ${result.temporaryPassword}` : result.message ?? "Action terminée.");
      if (result.success) { setSelected(new Set()); setConfirm(null); setAssignment(null); router.refresh(); }
    });
  }
  function ask(title: string, description: string, action: () => Promise<ActionResult>) { setConfirm({ title, description, action }); }
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function exportSelection() {
    const result = await exportSelectedUsersCsv(selectedIds);
    if ("error" in result) { setMessage(result.error); return; }
    downloadCsv(result.csv, result.filename);
  }

  return <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]" aria-busy={pending}>
    {selected.size ? <div className="flex min-h-11 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-muted/35 px-3 text-xs"><strong className="whitespace-nowrap">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</strong><BulkButton onClick={() => run(() => bulkSetUserState(selectedIds, "ACTIVE"))}>Activer</BulkButton><BulkButton sensitive onClick={() => ask("Suspendre les comptes ?", "Leur accès sera immédiatement interrompu.", () => bulkSetUserState(selectedIds, "SUSPENDED"))}>Suspendre</BulkButton><BulkButton sensitive onClick={() => ask("Bannir les comptes ?", "Les comptes sélectionnés ne pourront plus se connecter.", () => bulkSetUserState(selectedIds, "BANNED"))}>Bannir</BulkButton><BulkButton onClick={() => setAssignment({ kind: "company", ids: selectedIds })}>Affecter à une société</BulkButton><BulkButton onClick={() => setAssignment({ kind: "course", ids: selectedIds })}>Inscrire à une formation</BulkButton><BulkButton onClick={() => void exportSelection()}>Exporter</BulkButton><BulkButton sensitive onClick={() => ask("Supprimer les comptes ?", "Une demande de suppression RGPD sera créée pour chaque compte.", async () => { for (const id of selectedIds) { const result = await deleteUserGdpr(id); if (!result.success) return result; } return { success: true, message: `${selectedIds.length} demandes de suppression créées.` }; })}>Supprimer</BulkButton><button type="button" className="ml-auto whitespace-nowrap text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>Annuler</button></div> : message ? <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-border bg-muted/35 px-3 text-xs" role="status"><span className="truncate" title={message}>{message}</span><button onClick={() => setMessage(null)} aria-label="Fermer">×</button></div> : null}
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
      <table className="w-full min-w-[66rem] table-fixed text-sm">
        <colgroup><col className="w-12" /><col className="w-[28%]" /><col className="w-[18%]" /><col className="w-28" /><col className="w-32" /><col className="w-24" /><col className="w-32" /><col className="w-16" /></colgroup>
        <thead className="sticky top-0 z-20 border-b border-border bg-card text-left text-[10px] uppercase tracking-[.08em] text-muted-foreground shadow-[0_1px_0_var(--border)]"><tr className="h-10"><th className="px-4"><Checkbox checked={allSelected} aria-label="Sélectionner la page" onChange={(event) => setSelected(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())} /></th><SortHeader label="Apprenant" field="name" params={params} /><SortHeader label="Société" field="company" params={params} /><SortHeader label="Statut" field="status" params={params} /><SortHeader label="Pays" field="country" params={params} /><th className="px-3 text-center">Formations</th><SortHeader label="Inscription" field="createdAt" params={params} /><th className="px-3 text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-border/60">{rows.map((user) => <tr key={user.id} className="h-14 hover:bg-muted/35 data-[selected=true]:bg-[color:var(--brand-secondary)]/5" data-selected={selected.has(user.id)}><td className="px-4"><Checkbox checked={selected.has(user.id)} aria-label={`Sélectionner ${user.name ?? user.email}`} onChange={() => toggle(user.id)} /></td><td className="px-3"><div className="flex min-w-0 items-center gap-2.5"><UserAvatar user={user} /><div className="min-w-0"><Link href={`/admin/utilisateurs/${user.id}`} title={user.name ?? user.email} className="block truncate font-semibold hover:underline">{user.name ?? user.email}</Link><p title={user.email} className="truncate text-[10px] text-muted-foreground">{user.email}</p></div></div></td><td className="truncate px-3 text-muted-foreground" title={user.companyName ?? "Sans société"}>{user.companyName ?? "—"}</td><td className="px-3"><UserStatusBadge status={user.status} banned={Boolean(user.bannedAt)} /></td><td className="truncate px-3 text-muted-foreground" title={user.country ?? "Pays non renseigné"}>{user.country ?? "—"}</td><td className="px-3 text-center font-semibold tabular-nums">{user.enrollmentsCount}</td><td className="px-3 text-xs text-muted-foreground"><time dateTime={user.createdAt.toISOString()}>{learnerDateFormatter.format(user.createdAt)}</time></td><td className="px-3 text-right"><UserMenu user={user} disabled={pending} run={run} ask={ask} assign={(kind) => setAssignment({ kind, ids: [user.id] })} /></td></tr>)}</tbody>
      </table>
    </div>
    <footer className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-t border-border px-4 text-xs text-muted-foreground"><span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} sur ${total}` : "0 résultat"}</span><div className="flex items-center gap-4"><label className="hidden items-center gap-2 sm:flex">Lignes par page<Select value={pageSize} aria-label="Lignes par page" className="h-8 w-20 py-1" onChange={(event) => router.push(href({ pageSize: event.target.value, page: "1" }))}><option value="25">25</option><option value="50">50</option><option value="100">100</option></Select></label><nav className="flex items-center gap-1" aria-label="Pagination des apprenants"><PageArrow href={href({ page: String(page - 1) })} disabled={page <= 1} label="Page précédente"><ChevronLeft className="h-4 w-4" /></PageArrow>{paginationNumbers(page, totalPages).map((item, index) => item === "…" ? <span key={`e-${index}`} className="w-8 text-center">…</span> : <Link key={item} href={href({ page: String(item) })} aria-current={item === page ? "page" : undefined} className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-medium ${item === page ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>{item}</Link>)}<PageArrow href={href({ page: String(page + 1) })} disabled={page >= totalPages} label="Page suivante"><ChevronRight className="h-4 w-4" /></PageArrow></nav></div></footer>
    <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm?.title ?? "Confirmer"} description={confirm?.description} destructive pending={pending} onConfirm={() => { if (confirm) run(confirm.action); }} />
    {assignment ? <AssignmentDialog assignment={assignment} companies={companies} courses={courses} pending={pending} onClose={() => setAssignment(null)} onRun={run} /> : null}
  </section>;
}

function UserMenu({ user, disabled, run, ask, assign }: { user: AdminUserRow; disabled: boolean; run: (action: () => Promise<ActionResult>) => void; ask: (title: string, description: string, action: () => Promise<ActionResult>) => void; assign: (kind: "company" | "course") => void }) {
  return <details className="group relative inline-block text-left"><summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted [&::-webkit-details-marker]:hidden" aria-label={`Actions pour ${user.name ?? user.email}`}><EllipsisVertical className="h-4 w-4" /></summary><div className="fixed right-8 z-50 mt-1 w-56 rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-xl"><MenuLink href={`/admin/utilisateurs/${user.id}`} icon={<Eye className="h-4 w-4" />}>Voir le profil</MenuLink><MenuLink href={`/admin/utilisateurs/${user.id}`} icon={<Pencil className="h-4 w-4" />}>Modifier</MenuLink><MenuButton icon={<GraduationCap className="h-4 w-4" />} onClick={() => assign("course")}>Inscrire à une formation</MenuButton><MenuButton icon={<Building2 className="h-4 w-4" />} onClick={() => assign("company")}>Affecter à une société</MenuButton><MenuButton disabled={disabled} icon={<KeyRound className="h-4 w-4" />} onClick={() => ask("Réinitialiser le mot de passe ?", "Toutes les sessions ouvertes seront invalidées. Le nouveau mot de passe ne sera affiché qu’une fois.", async () => { const form = new FormData(); form.set("userId", user.id); return resetCenterAccountPassword({ success: false }, form); })}>Réinitialiser le mot de passe</MenuButton>{user.status === "ACTIVE" && !user.bannedAt ? <MenuButton disabled={disabled} icon={<ShieldOff className="h-4 w-4" />} onClick={() => ask("Suspendre ce compte ?", "Son accès sera immédiatement interrompu.", () => suspendUser(user.id, "Action administrateur depuis la liste"))}>Suspendre</MenuButton> : <MenuButton disabled={disabled} icon={<Check className="h-4 w-4" />} onClick={() => run(() => reactivateUser(user.id))}>Activer</MenuButton>}<MenuButton disabled={disabled} icon={<Ban className="h-4 w-4" />} onClick={() => ask("Bannir ce compte ?", "La personne ne pourra plus se connecter.", () => banUser(user.id, "Action administrateur depuis la liste"))}>Bannir</MenuButton><MenuButton danger disabled={disabled} icon={<Trash2 className="h-4 w-4" />} onClick={() => ask("Supprimer ce compte ?", "Une demande de suppression RGPD sera enregistrée.", () => deleteUserGdpr(user.id))}>Supprimer</MenuButton></div></details>;
}

function AssignmentDialog({ assignment, companies, courses, pending, onClose, onRun }: { assignment: { kind: "company" | "course"; ids: string[] }; companies: Choice[]; courses: Choice[]; pending: boolean; onClose: () => void; onRun: (action: () => Promise<ActionResult>) => void }) {
  const [value, setValue] = useState(""); const choices = assignment.kind === "company" ? companies : courses;
  return <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true"><button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fermer" /><div className="relative w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"><h2 className="font-semibold">{assignment.kind === "company" ? "Affecter à une société" : "Inscrire à une formation"}</h2><p className="mt-1 text-sm text-muted-foreground">{assignment.ids.length} compte{assignment.ids.length > 1 ? "s" : ""} sélectionné{assignment.ids.length > 1 ? "s" : ""}.</p><Select className="mt-4" value={value} onChange={(event) => setValue(event.target.value)}><option value="">Sélectionner…</option>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name ?? choice.title}</option>)}</Select><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button disabled={!value || pending} onClick={() => onRun(async () => { if (assignment.kind === "company") return bulkAssignCompany(assignment.ids, value); const form = new FormData(); form.set("courseId", value); assignment.ids.forEach((id) => form.append("userIds", id)); return grantCourseToUsers({ success: false }, form); })}>Confirmer</Button></div></div></div>;
}

function SortHeader({ label, field, params }: { label: string; field: AdminUsersSort; params: Params }) { const active = params.sort === field; const direction = active && params.direction === "asc" ? "asc" : "desc"; const search = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (value && key !== "page") search.set(key, value); search.set("sort", field); search.set("direction", active && direction === "desc" ? "asc" : "desc"); const Icon = active ? direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown; return <th className="px-3"><Link href={`/admin/utilisateurs?${search}`} className="inline-flex items-center gap-1 hover:text-foreground">{label}<Icon className={`h-3 w-3 ${active ? "text-foreground" : "opacity-40"}`} /></Link></th>; }
function UserAvatar({ user }: { user: AdminUserRow }) { const initials = (user.name ?? user.email).split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 text-[10px] font-bold text-slate-700 dark:from-blue-500/20 dark:to-emerald-500/20 dark:text-slate-200">{initials || "U"}</span>; }
function UserStatusBadge({ status, banned }: { status: AccountStatus; banned: boolean }) { if (banned) return <StatusBadge tone="danger">Banni</StatusBadge>; if (status === "SUSPENDED") return <StatusBadge tone="warning">Suspendu</StatusBadge>; if (status === "DELETED") return <StatusBadge tone="neutral">Supprimé</StatusBadge>; if (status === "PENDING_VERIFICATION") return <StatusBadge tone="warning">En attente</StatusBadge>; return <StatusBadge tone="success">Actif</StatusBadge>; }
function BulkButton({ children, sensitive, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { sensitive?: boolean }) { return <button type="button" className={`whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 font-medium hover:bg-muted disabled:opacity-40 ${sensitive ? "text-destructive" : ""}`} {...props}>{children}</button>; }
function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) { return <Link href={href} className="flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-muted">{icon}{children}</Link>; }
function MenuButton({ icon, children, danger, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode; danger?: boolean }) { return <button type="button" className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-muted disabled:opacity-40 ${danger ? "text-destructive" : ""}`} {...props}>{icon}{children}</button>; }
function PageArrow({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) { return disabled ? <span className="flex h-8 w-8 items-center justify-center opacity-35">{children}</span> : <Link href={href} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted">{children}</Link>; }
function paginationNumbers(page: number, total: number): Array<number | "…"> { if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1); const result: Array<number | "…"> = [1]; if (page > 3) result.push("…"); for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) result.push(i); if (page < total - 2) result.push("…"); result.push(total); return result; }
function downloadCsv(csv: string, filename: string) { const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
