"use client";

import { useEffect, useState } from "react";

export function VirtualClassCountdown({ startsAt }: { startsAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(startsAt).getTime() - Date.now()));
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [startsAt]);
  if (remaining === null || remaining <= 0) return null;
  const totalMinutes = Math.ceil(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return <p className="mt-3 text-sm font-semibold text-[color:var(--brand-primary)]" aria-live="polite">Disponible dans {days ? `${days} j ` : ""}{hours ? `${hours} h ` : ""}{minutes} min</p>;
}
