"use client";

import { PreJoin } from "@livekit/components-react";
import type { LocalUserChoices } from "@livekit/components-core";
import { Camera, Info, Radio, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function VirtualClassPreJoin({ id, title, displayName, recordingEnabled, role }: { id: string; title: string; displayName: string; recordingEnabled: boolean; role: "ADMIN" | "INSTRUCTOR" | "STUDENT" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const online = typeof navigator === "undefined" || navigator.onLine;

  function submit(choices: LocalUserChoices) {
    sessionStorage.setItem(`virtual-class:${id}:choices`, JSON.stringify(choices));
    router.push(`/classes-virtuelles/${id}/salle`);
  }

  return <div className="mx-auto max-w-5xl space-y-5"><header className="rounded-2xl border bg-card p-5 shadow-sm"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[color:var(--brand-primary)]"><Radio className="h-4 w-4" />Vérification technique</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><p className="mt-1 text-sm text-muted-foreground">Testez vos périphériques avant d’entrer dans la salle privée.</p></header><div className="grid gap-5 lg:grid-cols-[1fr_280px]"><div data-lk-theme="default" className="overflow-hidden rounded-2xl border bg-slate-950 p-3 shadow-lg"><PreJoin defaults={{ username: displayName, videoEnabled: role !== "STUDENT", audioEnabled: role !== "STUDENT" }} onSubmit={submit} onError={(cause) => setError(cause.message || "Impossible d’accéder aux périphériques.")} joinLabel="Rejoindre maintenant" micLabel="Microphone" camLabel="Caméra" userLabel="Nom affiché" persistUserChoices={false} /></div><aside className="space-y-3"><div className="rounded-xl border bg-card p-4"><h2 className="flex items-center gap-2 font-semibold"><Wifi className="h-4 w-4" />Connexion</h2><p className={online ? "mt-2 text-sm text-emerald-700" : "mt-2 text-sm text-red-700"}>{online ? "Connexion réseau détectée" : "Aucune connexion réseau détectée"}</p></div><div className="rounded-xl border bg-card p-4"><h2 className="flex items-center gap-2 font-semibold"><Camera className="h-4 w-4" />Confidentialité</h2><p className="mt-2 text-sm text-muted-foreground">Vous pouvez entrer sans caméra. Un apprenant rejoint avec le micro et la caméra désactivés jusqu’à autorisation.</p></div>{recordingEnabled ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><h2 className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" />Enregistrement possible</h2><p className="mt-2 text-sm">La séance peut être enregistrée, mais jamais silencieusement. Un indicateur permanent sera affiché.</p></div> : null}{error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}</aside></div></div>;
}
