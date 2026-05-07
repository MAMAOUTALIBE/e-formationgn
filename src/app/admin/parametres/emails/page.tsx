import { redirect } from "next/navigation";

// Les templates emails sont gérés depuis le module Marketing > Campagnes.
export default function EmailTemplatesRedirect() {
  redirect("/admin/marketing/campagnes-email");
}
