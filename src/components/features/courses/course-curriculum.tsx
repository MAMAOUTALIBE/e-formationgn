import { pluralize } from "@/lib/format/labels";

interface SectionSummary {
  id: string;
  title: string;
}

interface CourseCurriculumProps {
  sections: SectionSummary[];
}

const SECTION_ACCENTS = [
  {
    borderColor: "#2563eb",
    badge: "bg-[#eff6ff] text-[#1d4ed8]",
  },
  {
    borderColor: "#16a34a",
    badge: "bg-[#ecfdf3] text-[#15803d]",
  },
  {
    borderColor: "#06b6d4",
    badge: "bg-[#ecfeff] text-[#0e7490]",
  },
  {
    borderColor: "#8b5cf6",
    badge: "bg-[#f5f3ff] text-[#6d28d9]",
  },
] as const;

export function CourseCurriculum({ sections }: CourseCurriculumProps) {
  if (sections.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        Le programme détaillé sera publié prochainement.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-5 text-sm text-muted-foreground">
        {sections.length} {pluralize(sections.length, "section")}
      </p>

      <ol className="space-y-3">
        {sections.map((section, index) => {
          const accent = SECTION_ACCENTS[index % SECTION_ACCENTS.length];

          return (
            <li
              key={section.id}
              className="flex min-h-20 items-center gap-4 rounded-xl border border-l-[6px] border-[#d8e4df] bg-card px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:gap-5 sm:px-6"
              style={{ borderLeftColor: accent.borderColor }}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${accent.badge}`}
              >
                {index + 1}
              </span>
              <h3 className="min-w-0 text-sm font-semibold text-foreground sm:text-base">
                {section.title}
              </h3>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
