"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Select } from "@/components/ui/select";
import { SORT_LABELS } from "@/lib/format/labels";
import { SORT_OPTIONS } from "@/lib/validators/courses";

interface CourseSortProps {
  className?: string;
}

export function CourseSort({ className }: CourseSortProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = params.get("sort") ?? "relevance";

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    if (event.target.value === "relevance") next.delete("sort");
    else next.set("sort", event.target.value);
    next.delete("page");
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <label htmlFor="course-sort" className="text-sm text-muted-foreground">
        Trier par
      </label>
      <Select
        id="course-sort"
        value={current}
        onChange={handleChange}
        disabled={pending}
        className="w-44"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </Select>
    </div>
  );
}
