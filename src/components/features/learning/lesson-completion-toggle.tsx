"use client";

import { Check, Circle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { toggleLessonCompletion } from "@/server/actions/learning";

interface LessonCompletionToggleProps {
  lessonId: string;
  initialCompleted: boolean;
}

export function LessonCompletionToggle({
  lessonId,
  initialCompleted,
}: LessonCompletionToggleProps) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setCompleted((c) => !c);
    startTransition(async () => {
      await toggleLessonCompletion(lessonId);
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      variant={completed ? "outline" : "default"}
    >
      {completed ? (
        <>
          <Check className="h-4 w-4" /> Terminée
        </>
      ) : (
        <>
          <Circle className="h-4 w-4" /> Marquer comme terminée
        </>
      )}
    </Button>
  );
}
