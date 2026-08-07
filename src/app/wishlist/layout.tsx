import { AccountShell } from "@/components/features/workspace/account-shell";

// Écran de compte : la coquille monte la navigation du rôle de celui qui
// regarde (cf. account-shell.tsx).
export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell callbackUrl="/wishlist">{children}</AccountShell>;
}
