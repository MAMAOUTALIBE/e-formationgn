import { AccountShell } from "@/components/features/workspace/account-shell";

export default function VirtualClassesLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell callbackUrl="/classes-virtuelles">{children}</AccountShell>;
}
