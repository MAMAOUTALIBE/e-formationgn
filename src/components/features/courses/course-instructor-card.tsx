import { ExternalLink } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";

interface CourseInstructorCardProps {
  instructor: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    headline: string | null;
    bio: string | null;
    image: string | null;
    websiteUrl?: string | null;
    linkedinUrl?: string | null;
  };
}

export function CourseInstructorCard({ instructor }: CourseInstructorCardProps) {
  const name =
    instructor.name ??
    ([instructor.firstName, instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur Gandal");

  const initials =
    `${instructor.firstName?.[0] ?? ""}${instructor.lastName?.[0] ?? ""}`.trim() ||
    name[0]?.toUpperCase() ||
    "?";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <Avatar src={instructor.image} alt={name} fallback={initials} size={56} />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{name}</h3>
          {instructor.headline ? (
            <p className="text-sm text-muted-foreground">{instructor.headline}</p>
          ) : null}
        </div>
      </div>

      {instructor.bio ? (
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {instructor.bio}
        </p>
      ) : null}

      {(instructor.websiteUrl || instructor.linkedinUrl) ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {instructor.websiteUrl ? (
            <a
              href={instructor.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[color:var(--brand-secondary)] hover:underline"
            >
              Site web <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
          {instructor.linkedinUrl ? (
            <a
              href={instructor.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[color:var(--brand-secondary)] hover:underline"
            >
              LinkedIn <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
