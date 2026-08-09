import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCourseDetailLoading() {
  return (
    <div className="page-course-detail flex h-full min-h-0 flex-col gap-3 overflow-hidden" aria-label="Chargement du cours">
      <div className="flex h-10 shrink-0 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-1.5"><Skeleton className="h-5 w-56" /><Skeleton className="h-3 w-32" /></div>
        </div>
        <div className="flex gap-2"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-9" /></div>
      </div>
      <Skeleton className="h-10 shrink-0 rounded-md xl:hidden" />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-12 xl:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)]">
        <Skeleton className="h-full rounded-xl xl:col-span-8 xl:h-44" />
        <Skeleton className="hidden rounded-xl xl:col-span-4 xl:row-span-2 xl:block" />
        <Skeleton className="hidden rounded-xl xl:col-span-8 xl:block" />
        <Skeleton className="hidden rounded-xl xl:col-span-8 xl:block" />
        <Skeleton className="hidden rounded-xl xl:col-span-4 xl:block" />
      </div>
    </div>
  );
}
