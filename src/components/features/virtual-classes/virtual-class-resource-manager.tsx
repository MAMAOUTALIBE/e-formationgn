"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { addVirtualClassResource, deleteVirtualClassResource } from "@/server/actions/virtual-classes";

interface Resource { id: string; title: string; contentType: string; visibility: string; downloadable: boolean }

export function VirtualClassResourceManager({ virtualClassId, resources, disabled = false }: { virtualClassId: string; resources: Resource[]; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<Resource | null>(null);

  async function submit(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return setMessage("Sélectionnez un fichier.");
    setMessage("Dépôt du fichier…");
    try {
      const authorization = await fetch("/api/upload/virtual-class-resource", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ virtualClassId, filename: file.name, contentType: file.type, sizeBytes: file.size }) });
      const upload = await authorization.json() as { uploadUrl?: string; publicUrl?: string; error?: string };
      if (!authorization.ok || !upload.uploadUrl || !upload.publicUrl) throw new Error(upload.error || "Dépôt impossible.");
      const response = await fetch(upload.uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
      if (!response.ok) throw new Error("Le transfert du fichier a échoué.");
      const result = await addVirtualClassResource({ virtualClassId, title: String(formData.get("title") || file.name), description: "", storageUrl: upload.publicUrl, contentType: file.type || "application/octet-stream", fileSizeBytes: file.size, visibility: String(formData.get("visibility") || "ALWAYS") as "BEFORE" | "DURING" | "AFTER" | "ALWAYS", downloadable: formData.get("downloadable") === "on" });
      if (!result.success) throw new Error(result.message);
      setMessage("Document ajouté.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Dépôt impossible."); }
  }

  function remove() {
    const target = toRemove;
    if (!target) return;
    startTransition(async () => {
      const result = await deleteVirtualClassResource(target.id);
      if (!result.success) {
        toast.error(result.message ?? "Le document n’a pas pu être retiré.");
        return;
      }
      toast.success(result.message ?? "Document retiré.");
      setToRemove(null);
      router.refresh();
    });
  }

  return <div className="space-y-4"><div className="space-y-2">{resources.map((resource) => <div key={resource.id} className="flex items-center gap-3 rounded-lg border p-3"><FileText className="h-5 w-5 shrink-0 text-[color:var(--brand-primary)]" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{resource.title}</strong><span className="block text-xs text-muted-foreground">{resource.visibility} · {resource.contentType}</span></span>{!disabled ? <Button type="button" variant="ghost" size="icon" aria-label={`Retirer ${resource.title}`} disabled={pending} onClick={() => setToRemove(resource)}><Trash2 className="h-4 w-4" /></Button> : null}</div>)}{!resources.length ? <p className="text-sm text-muted-foreground">Aucun document partagé.</p> : null}</div>{!disabled ? <form action={submit} className="space-y-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-3 dark:bg-blue-950/15"><div className="grid gap-3 sm:grid-cols-2"><Input name="title" placeholder="Titre du document" maxLength={180} /><Input name="file" type="file" required /></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><Select name="visibility" defaultValue="ALWAYS" aria-label="Moment de disponibilité"><option value="BEFORE">Avant la séance</option><option value="DURING">Pendant la séance</option><option value="AFTER">Après la séance</option><option value="ALWAYS">Toujours</option></Select><label className="flex items-center gap-2 whitespace-nowrap text-sm"><Checkbox name="downloadable" defaultChecked />Téléchargeable</label><Button type="submit" disabled={pending} className="sm:ml-auto"><Upload className="h-4 w-4" />Ajouter</Button></div></form> : null}{message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}<ConfirmDialog open={Boolean(toRemove)} onClose={() => setToRemove(null)} title={`Retirer « ${toRemove?.title ?? "ce document"} » ?`} description="Le document ne sera plus accessible aux participants de la séance." confirmLabel="Retirer le document" destructive pending={pending} onConfirm={remove} /></div>;
}
