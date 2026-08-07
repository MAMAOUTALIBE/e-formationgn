import { AccountShell } from "@/components/features/workspace/account-shell";

// Écran de compte : la coquille monte la navigation du rôle de CELUI QUI
// REGARDE. Un formateur consulte le même profil qu'un élève et doit y garder
// son propre menu.
export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell callbackUrl="/profil">{children}</AccountShell>;
}
