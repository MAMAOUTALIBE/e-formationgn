"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteAnnouncement } from "@/server/actions/announcements";

export function AnnouncementDeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm("Supprimer cette annonce ?")) return;
        startTransition(async () => {
          await deleteAnnouncement(id);
        });
      }}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      Supprimer
    </Button>
  );
}
