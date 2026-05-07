import Link from "next/link";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";

interface NotificationBellProps {
  unreadCount: number;
  className?: string;
}

export function NotificationBell({ unreadCount, className }: NotificationBellProps) {
  return (
    <Link
      href="/notifications"
      aria-label={`Notifications (${unreadCount} non lues)`}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted",
        className,
      )}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[color:var(--brand-danger)] px-1.5 text-[10px] font-semibold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
