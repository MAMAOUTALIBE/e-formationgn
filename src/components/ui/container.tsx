import * as React from "react";

import { cn } from "@/lib/utils";

export function Container({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto min-w-0 w-full max-w-[2400px] px-[clamp(0.75rem,2vw,2.5rem)]", className)}
      {...props}
    />
  );
}
