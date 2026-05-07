import { AdminPageSkeleton } from "@/components/features/admin/admin-loading";

export default function AnalyticsLoading() {
  return <AdminPageSkeleton kpis={4} withChart />;
}
