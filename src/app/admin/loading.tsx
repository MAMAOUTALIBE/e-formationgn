import { AdminPageSkeleton } from "@/components/features/admin/admin-loading";

export default function AdminLoading() {
  return <AdminPageSkeleton kpis={8} withChart />;
}
