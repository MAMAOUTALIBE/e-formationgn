import { Skeleton } from "@/components/ui/skeleton";

export default function UsersLoading() {
  return <div className="flex h-full max-h-[calc(100dvh-12.5rem)] min-h-0 flex-col gap-3 overflow-hidden" aria-label="Chargement des apprenants"><div className="flex h-10 shrink-0 items-center justify-between"><Skeleton className="h-8 w-80" /><Skeleton className="h-9 w-96" /></div><Skeleton className="h-16 shrink-0 rounded-xl" /><Skeleton className="h-14 shrink-0 rounded-xl" /><div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card"><Skeleton className="h-10 w-full rounded-none" />{Array.from({ length: 9 }, (_, index) => <div key={index} className="flex h-14 items-center gap-4 border-t border-border/60 px-4"><Skeleton className="h-4 w-4" /><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-1/4" /><Skeleton className="ml-auto h-4 w-24" /></div>)}</div></div>;
}
