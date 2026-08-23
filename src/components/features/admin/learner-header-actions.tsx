"use client";

import { useState } from "react";
import { FileUp, Plus, X } from "lucide-react";

import { CreateAccountForm, type CompanyOption } from "@/components/features/admin/create-account-form";
import { ImportStudentsForm } from "@/components/features/admin/import-students-form";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { exportUsersCsv } from "@/server/actions/admin-users";
import type { AdminUsersFilters } from "@/server/queries/admin-users";

// `exportFilters` reçoit les filtres actifs de l'écran. Sans eux, l'export
// sortait tous les apprenants de toutes les sociétés clientes, quel que soit
// le périmètre affiché — cf. la note dans `exportUsersCsv`.
export function LearnerHeaderActions({ companies, courses, trainingCenter, exportFilters }: { companies: CompanyOption[]; courses: Array<{ id: string; title: string }>; trainingCenter: boolean; exportFilters: AdminUsersFilters }) {
  const [modal, setModal] = useState<"import" | "create" | null>(null);
  return <><div className="flex shrink-0 items-center gap-2">{trainingCenter ? <Button variant="outline" size="sm" className="h-9" onClick={() => setModal("import")}><FileUp className="h-4 w-4" />Importer une promotion</Button> : null}<ExportButton action={() => exportUsersCsv(exportFilters)} label="Exporter" />{trainingCenter ? <Button size="sm" className="h-9" onClick={() => setModal("create")}><Plus className="h-4 w-4" />Créer un apprenant</Button> : null}</div>{modal ? <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true"><button className="absolute inset-0 bg-black/45" onClick={() => setModal(null)} aria-label="Fermer" /><div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold">{modal === "create" ? "Créer un apprenant" : "Importer une promotion"}</h2><p className="text-sm text-muted-foreground">{modal === "create" ? "Ajouter uniquement un compte élève." : "Créer plusieurs comptes apprenants depuis un fichier CSV."}</p></div><Button variant="ghost" size="icon" onClick={() => setModal(null)} aria-label="Fermer"><X className="h-4 w-4" /></Button></div>{modal === "create" ? <CreateAccountForm companies={companies} /> : <ImportStudentsForm courses={courses} />}</div></div> : null}</>;
}
