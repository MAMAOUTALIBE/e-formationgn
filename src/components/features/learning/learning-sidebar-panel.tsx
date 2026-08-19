"use client";

import { ListVideo, Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface LearningSidebarPanelProps {
  /** En-tête « Contenu du cours · X/Y · % » (affiché au-dessus du programme). */
  header: React.ReactNode;
  /** Le programme (LearningSidebar). */
  curriculum: React.ReactNode;
  /** Le tuteur IA (LessonTutor). */
  tutor: React.ReactNode;
}

/**
 * Panneau de droite à deux onglets, façon Udemy : « Contenu du cours » et
 * « Tuteur IA ». Le tuteur est ainsi accessible sans quitter la vidéo.
 */
export function LearningSidebarPanel({
  header,
  curriculum,
  tutor,
}: LearningSidebarPanelProps) {
  const [tab, setTab] = useState<"content" | "tutor">("content");

  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
      active
        ? "border-[color:var(--brand-primary)] text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Panneau de la formation" className="flex border-b border-border">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "content"}
          onClick={() => setTab("content")}
          className={tabClass(tab === "content")}
        >
          <ListVideo className="h-4 w-4" aria-hidden />
          Contenu de la formation
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "tutor"}
          onClick={() => setTab("tutor")}
          className={tabClass(tab === "tutor")}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Tuteur IA
        </button>
      </div>

      {tab === "content" ? (
        <div>
          {header}
          {curriculum}
        </div>
      ) : (
        <div className="p-4">{tutor}</div>
      )}
    </div>
  );
}
