import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";

interface CartIconProps {
  count?: number;
  className?: string;
}

export function CartIcon({ count = 0, className }: CartIconProps) {
  return (
    <Link
      href="/panier"
      aria-label={`Panier (${count} ${count > 1 ? "articles" : "article"})`}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted",
        className,
      )}
    >
      <ShoppingCart className="h-5 w-5" aria-hidden />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[color:var(--brand-secondary)] px-1.5 text-[10px] font-semibold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
