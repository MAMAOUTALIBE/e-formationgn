import { CalendarDays, Clock3, Radio, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";

import { VirtualClassStatus } from "@/components/features/virtual-classes/virtual-class-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatVirtualClassShortDate, virtualClassPersonName } from "@/lib/virtual-class-display";

interface VirtualClassCardProps {
  item: {
    id: string;
    title: string;
    startsAt: Date;
    durationMinutes: number;
    timezone: string;
    status: string;
    maxParticipants: number | null;
    trainingSession: { reference: string | null; program: { title: string } };
    instructor: { name: string | null; firstName: string | null; lastName: string | null; email: string };
  };
  detailHref: string;
  joinHref?: string;
  prepareHref?: string;
  attendanceLabel?: string;
}

export function VirtualClassCard({ item, detailHref, joinHref, prepareHref, attendanceLabel }: VirtualClassCardProps) {
  const canJoin = (item.status === "OPEN" || item.status === "LIVE") && joinHref;
  return (
    <Card className="overflow-hidden border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
      <div className={item.status === "LIVE" ? "h-1 bg-red-500" : "h-1 bg-[color:var(--brand-primary)]"} />
      <CardContent className="space-y-4 p-4 sm:p-5 lg:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <VirtualClassStatus status={item.status} />
              {item.trainingSession.reference ? <span className="text-xs font-medium text-muted-foreground">{item.trainingSession.reference}</span> : null}
            </div>
            {/* `break-words` : un titre d'un seul long mot (référence interne,
                URL collée) débordait de la carte, le conteneur `min-w-0` ne
                suffisant pas à couper un mot insécable. */}
            <Link href={detailHref} className="block break-words text-lg font-semibold leading-snug text-foreground hover:underline">
              {item.title}
            </Link>
            <p className="mt-1 break-words text-sm text-muted-foreground">{item.trainingSession.program.title}</p>
          </div>
          {item.status === "LIVE" ? (
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
              <Radio className="h-3.5 w-3.5" /> EN DIRECT
            </span>
          ) : null}
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
          <span className="flex min-w-0 items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" /><span className="truncate">{formatVirtualClassShortDate(item.startsAt, item.timezone)}</span></span>
          <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{item.durationMinutes} min</span>
          <span className="flex min-w-0 items-center gap-2"><UserRound className="h-4 w-4 shrink-0" /><span className="truncate">{virtualClassPersonName(item.instructor)}</span></span>
          {item.maxParticipants ? <span className="flex items-center gap-2"><UsersRound className="h-4 w-4" />{item.maxParticipants} places</span> : null}
          {attendanceLabel ? <span className="flex items-center gap-2"><UsersRound className="h-4 w-4" />{attendanceLabel}</span> : null}
        </div>
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          {prepareHref ? <Button asChild variant="outline" className="w-full sm:w-auto"><Link href={prepareHref}>Préparer la séance</Link></Button> : null}
          <Button asChild variant={canJoin ? "default" : "outline"} className="w-full sm:w-auto">
            <Link href={canJoin ? joinHref : detailHref}>{canJoin ? (item.status === "LIVE" ? "Classe en cours" : "Rejoindre la classe") : "Voir les détails"}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
