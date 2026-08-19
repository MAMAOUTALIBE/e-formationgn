import { Megaphone } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
  };
}

interface CourseAnnouncementsProps {
  announcements: Announcement[];
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function CourseAnnouncements({ announcements }: CourseAnnouncementsProps) {
  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
        <Megaphone className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">
          Aucune annonce pour le moment
        </p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          Quand le formateur publiera des informations importantes sur cette formation
          (mises à jour, événements, ressources), elles apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {announcements.map((a) => {
        const authorName =
          a.author.name ??
          ([a.author.firstName, a.author.lastName].filter(Boolean).join(" ") ||
            "Formateur");
        return (
          <li
            key={a.id}
            className="rounded-lg border border-border bg-card p-5"
          >
            <header className="mb-3 flex items-start gap-3">
              <Avatar
                src={a.author.image}
                alt={authorName}
                fallback={authorName.slice(0, 2)}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {a.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Par {authorName} ·{" "}
                  <time dateTime={a.createdAt.toISOString()}>
                    {dateFormatter.format(a.createdAt)}
                  </time>
                </p>
              </div>
            </header>
            <div className="prose prose-sm max-w-none whitespace-pre-line text-foreground">
              {a.body}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
