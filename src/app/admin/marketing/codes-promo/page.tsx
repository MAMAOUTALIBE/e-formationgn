import { redirect } from "next/navigation";

// Le module codes-promo principal vit sur /admin/codes-promo (héritage v1).
// On redirige pour que la sidebar Marketing soit cohérente.
export default function MarketingPromoCodesRedirect() {
  redirect("/admin/codes-promo");
}
