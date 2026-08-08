import { LogOut, UserCog } from "lucide-react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { stopImpersonation } from "@/server/actions/admin-impersonation";

export async function ImpersonationBanner() {
  const session = await auth();
  if (!session?.impersonation) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <span className="inline-flex items-center gap-2">
        <UserCog className="h-4 w-4" aria-hidden />
        <strong>Mode impersonation actif</strong> · vous interagissez en tant que{" "}
        <span className="font-medium">{session.user.name ?? session.user.email}</span>
        <span className="text-amber-700/80 dark:text-amber-300/80">
          ({session.user.role})
        </span>
      </span>
      <form
        action={async () => {
          "use server";
          await stopImpersonation();
        }}
      >
        <Button type="submit" size="sm" variant="outline" className="gap-1.5">
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Quitter l&apos;impersonation
        </Button>
      </form>
    </div>
  );
}
