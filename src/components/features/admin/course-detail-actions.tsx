"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CourseDeleteButton } from "@/components/features/courses/course-delete-button";
import { Button } from "@/components/ui/button";

interface CourseDetailActionsProps {
  courseId: string;
  courseTitle: string;
  deletable: boolean;
  enrollments: number;
}

export function CourseDetailActions({
  courseId,
  courseTitle,
  deletable,
  enrollments,
}: CourseDetailActionsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeFromOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="icon"
        aria-label="Plus d’actions sur la formation"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Plus d’actions"
        onClick={() => setOpen((value) => !value)}
        className="h-9 w-9"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </Button>

      {open ? (
        <div
          role="menu"
          aria-label="Actions sur la formation"
          className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          <CourseDeleteButton
            courseId={courseId}
            courseTitle={courseTitle}
            mode="admin"
            deletable={deletable}
            enrollments={enrollments}
            presentation="menu-item"
          />
        </div>
      ) : null}
    </div>
  );
}
