"use client";

import { LiveKitRoom, VideoConference, useLocalParticipant, useParticipants, useRoomContext } from "@livekit/components-react";
import { Hand, MessageSquare, Mic, MicOff, Radio, Send, Shield, Square, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createVirtualClassMessage, endVirtualClass, moderateVirtualClassParticipant, startVirtualClassRecording, stopVirtualClassRecording } from "@/server/actions/virtual-classes";

interface Credentials { token: string; serverUrl: string; role: "ADMIN" | "INSTRUCTOR" | "STUDENT"; participantIdentity: string }

export function VirtualClassRoom({ id, title, recordingEnabled, recordingActive }: { id: string; title: string; recordingEnabled: boolean; recordingActive: boolean }) {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices] = useState(() => {
    const fallback = { audioEnabled: false, videoEnabled: false, audioDeviceId: "default", videoDeviceId: "default" };
    if (typeof window === "undefined") return fallback;
    const stored = sessionStorage.getItem(`virtual-class:${id}:choices`);
    if (!stored) return fallback;
    try { return { ...fallback, ...JSON.parse(stored) }; } catch { return fallback; }
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/classes-virtuelles/${id}/token`, { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" } })
      .then(async (response) => {
        const body = await response.json() as Credentials & { error?: string };
        if (!response.ok) throw new Error(body.error || "Impossible de rejoindre la salle.");
        setCredentials(body);
      })
      .catch((cause) => { if (cause.name !== "AbortError") setError(cause instanceof Error ? cause.message : "Impossible de rejoindre la salle."); });
    return () => controller.abort();
  }, [id]);

  if (error) return <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><h1 className="text-xl font-semibold text-red-900">Connexion impossible</h1><p className="mt-2 text-sm text-red-800">{error}</p><Button className="mt-4" variant="outline" onClick={() => router.push(`/classes-virtuelles/${id}`)}>Revenir aux détails</Button></div>;
  if (!credentials) return <div className="flex min-h-[55vh] items-center justify-center"><p className="animate-pulse text-sm text-muted-foreground">Connexion sécurisée à la salle…</p></div>;
  const moderator = credentials.role === "ADMIN" || credentials.role === "INSTRUCTOR";
  return <div data-lk-theme="default" className="overflow-hidden rounded-2xl border bg-[#10151c] text-white shadow-2xl"><LiveKitRoom token={credentials.token} serverUrl={credentials.serverUrl} connect audio={moderator && choices.audioEnabled ? { deviceId: choices.audioDeviceId } : false} video={moderator && choices.videoEnabled ? { deviceId: choices.videoDeviceId } : false} onDisconnected={() => router.push(`/classes-virtuelles/${id}`)} onError={(cause) => setError(cause.message)}><RoomHeader id={id} title={title} role={credentials.role} recordingEnabled={recordingEnabled} initialRecordingActive={recordingActive} /><div className="grid min-h-[68vh] lg:grid-cols-[minmax(0,1fr)_320px]"><main className="min-h-[55vh] min-w-0"><VideoConference className="h-full" /></main><RoomSidePanel virtualClassId={id} moderator={moderator} /></div></LiveKitRoom></div>;
}

function RoomHeader({ id, title, role, recordingEnabled, initialRecordingActive }: { id: string; title: string; role: Credentials["role"]; recordingEnabled: boolean; initialRecordingActive: boolean }) {
  const participants = useParticipants();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [raised, setRaised] = useState(localParticipant.attributes.handRaised === "true");
  const [seconds, setSeconds] = useState(0);
  const [ending, startEnding] = useTransition();
  const [recordingPending, startRecordingTransition] = useTransition();
  const [recording, setRecording] = useState(initialRecordingActive);
  useEffect(() => { const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, []);
  async function toggleHand() { const next = !raised; await localParticipant.setAttributes({ handRaised: String(next) }); setRaised(next); }
  const time = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  function toggleRecording() {
    startRecordingTransition(async () => {
      if (!recording) {
        if (!window.confirm("Confirmez-vous avoir informé tous les participants que la séance va être enregistrée ? Un indicateur rouge restera visible.")) return;
        const result = await startVirtualClassRecording(id, true);
        if (!result.success) return window.alert(result.message);
        setRecording(true);
      } else {
        const result = await stopVirtualClassRecording(id);
        if (!result.success) return window.alert(result.message);
        setRecording(false);
      }
    });
  }
  return <header className="flex flex-col gap-3 border-b border-white/10 bg-[#151b23] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-md border border-red-500 px-2 py-1 text-xs font-bold text-red-400"><Radio className="h-3 w-3" />EN DIRECT</span>{recording ? <span className="inline-flex animate-pulse items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white"><span className="h-2 w-2 rounded-full bg-white" />ENREGISTREMENT</span> : null}<span className="font-mono text-sm">{time}</span><span className="flex items-center gap-1 text-sm text-white/75"><UsersRound className="h-4 w-4" />{participants.length}</span></div><h1 className="mt-1 truncate text-base font-semibold sm:text-lg">{title}</h1></div><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" className={raised ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/25 bg-transparent text-white hover:bg-white/10"} onClick={toggleHand}><Hand className="h-4 w-4" />{raised ? "Baisser la main" : "Lever la main"}</Button>{role !== "STUDENT" && recordingEnabled ? <Button type="button" variant="outline" className={recording ? "border-red-500 bg-red-500/15 text-red-200" : "border-white/25 bg-transparent text-white"} disabled={recordingPending} onClick={toggleRecording}>{recording ? "Arrêter l’enregistrement" : "Enregistrer"}</Button> : null}{role !== "STUDENT" ? <Button type="button" variant="destructive" disabled={ending} onClick={() => window.confirm("Terminer la séance pour tout le monde ?") && startEnding(async () => { const result = await endVirtualClass(id); if (!result.success) window.alert(result.message); })}><Square className="h-4 w-4" />Terminer</Button> : null}<span className="hidden text-xs text-white/50 xl:inline">{role === "STUDENT" ? "Apprenant" : "Modérateur"} · {room.name}</span></div></header>;
}

function RoomSidePanel({ virtualClassId, moderator }: { virtualClassId: string; moderator: boolean }) {
  const [tab, setTab] = useState<"participants" | "discussion">("participants");
  return <aside className="flex max-h-[45vh] min-h-[320px] flex-col border-t border-white/10 bg-[#151b23] lg:max-h-none lg:min-h-0 lg:border-l lg:border-t-0"><div className="grid grid-cols-2 border-b border-white/10"><button type="button" onClick={() => setTab("participants")} className={tab === "participants" ? "border-b-2 border-emerald-400 p-3 text-sm font-semibold" : "p-3 text-sm text-white/60"}><UsersRound className="mr-1 inline h-4 w-4" />Participants</button><button type="button" onClick={() => setTab("discussion")} className={tab === "discussion" ? "border-b-2 border-emerald-400 p-3 text-sm font-semibold" : "p-3 text-sm text-white/60"}><MessageSquare className="mr-1 inline h-4 w-4" />Discussion</button></div>{tab === "participants" ? <ParticipantsPanel virtualClassId={virtualClassId} moderator={moderator} /> : <DiscussionPanel virtualClassId={virtualClassId} />}</aside>;
}

function ParticipantsPanel({ virtualClassId, moderator }: { virtualClassId: string; moderator: boolean }) {
  const participants = useParticipants();
  const [pending, startTransition] = useTransition();
  function moderate(identity: string, action: "ALLOW_MIC" | "REVOKE_MEDIA" | "REMOVE") {
    const userId = identity.startsWith("aiduca:") ? identity.slice(7) : "";
    if (!userId) return;
    startTransition(async () => { const result = await moderateVirtualClassParticipant({ virtualClassId, userId, action }); if (!result.success) window.alert(result.message); });
  }
  return <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">{participants.map((participant) => <div key={participant.identity} className="rounded-lg bg-white/5 p-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-xs font-bold">{participant.name?.slice(0, 2).toUpperCase() || "?"}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{participant.name || participant.identity}</span>{participant.isMicrophoneEnabled ? <Mic className="h-4 w-4 text-emerald-400" /> : <MicOff className="h-4 w-4 text-white/40" />}{participant.attributes.handRaised === "true" ? <Hand className="h-4 w-4 text-amber-400" /> : null}</div>{moderator && !participant.isLocal ? <div className="mt-2 flex flex-wrap gap-1"><button type="button" disabled={pending} className="rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10" onClick={() => moderate(participant.identity, "ALLOW_MIC")}><Shield className="mr-1 inline h-3 w-3" />Autoriser le micro</button><button type="button" disabled={pending} className="rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10" onClick={() => moderate(participant.identity, "REVOKE_MEDIA")}>Couper</button><button type="button" disabled={pending} className="rounded border border-red-500/50 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10" onClick={() => window.confirm("Exclure ce participant ?") && moderate(participant.identity, "REMOVE")}>Exclure</button></div> : null}</div>)}</div>;
}

interface RoomMessage { id: string; content: string; type: "MESSAGE" | "QUESTION"; authorName: string; mine: boolean; createdAt: string }
function DiscussionPanel({ virtualClassId }: { virtualClassId: string }) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [content, setContent] = useState("");
  const [type, setType] = useState<"MESSAGE" | "QUESTION">("MESSAGE");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    const load = () => fetch(`/api/classes-virtuelles/${virtualClassId}/messages`, { cache: "no-store" }).then((response) => response.json()).then((body: { messages?: RoomMessage[] }) => { if (active && body.messages) setMessages(body.messages); }).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 3_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [virtualClassId]);
  function send() { if (!content.trim()) return; startTransition(async () => { const result = await createVirtualClassMessage({ virtualClassId, content, type }); if (result.success) { setContent(""); const response = await fetch(`/api/classes-virtuelles/${virtualClassId}/messages`, { cache: "no-store" }); const body = await response.json() as { messages?: RoomMessage[] }; if (body.messages) setMessages(body.messages); } else window.alert(result.message); }); }
  return <div className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">{messages.map((message) => <div key={message.id} className={message.mine ? "ml-6 rounded-xl bg-emerald-700 p-2.5 text-sm" : "mr-6 rounded-xl bg-white/10 p-2.5 text-sm"}><span className="block text-[11px] font-semibold text-white/60">{message.authorName}{message.type === "QUESTION" ? " · Question" : ""}</span><p className="mt-1 break-words">{message.content}</p></div>)}{!messages.length ? <p className="p-3 text-center text-sm text-white/50">Aucun message.</p> : null}</div><div className="border-t border-white/10 p-3"><div className="mb-2 flex gap-2"><button type="button" onClick={() => setType("MESSAGE")} className={type === "MESSAGE" ? "text-xs font-semibold text-emerald-300" : "text-xs text-white/50"}>Message</button><button type="button" onClick={() => setType("QUESTION")} className={type === "QUESTION" ? "text-xs font-semibold text-emerald-300" : "text-xs text-white/50"}>Poser une question</button></div><div className="flex gap-2"><input value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} maxLength={2000} placeholder="Écrire un message…" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40" /><button type="button" aria-label="Envoyer" disabled={pending} onClick={send} className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-600 hover:bg-emerald-500"><Send className="h-4 w-4" /></button></div></div></div>;
}
