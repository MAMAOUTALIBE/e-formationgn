import * as React from "react";

import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: number;
}

export function Avatar({
  src,
  alt = "",
  fallback = "?",
  size = 36,
  className,
  ...props
}: AvatarProps) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{fallback.slice(0, 2)}</span>
      )}
      <span className="sr-only">{alt}</span>
    </div>
  );
}
