import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "default" | "light" | "mark";
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

const SOURCES: Record<NonNullable<LogoProps["variant"]>, { src: string; ratio: number }> = {
  default: { src: "/logo.svg", ratio: 320 / 96 },
  light: { src: "/logo-white.svg", ratio: 320 / 96 },
  mark: { src: "/logo-mark.svg", ratio: 1 },
};

export function Logo({
  variant = "default",
  className,
  width = 160,
  height,
  priority,
}: LogoProps) {
  const { src, ratio } = SOURCES[variant];
  const computedHeight = height ?? Math.round(width / ratio);
  return (
    <Image
      src={src}
      alt="E-FormationGN"
      width={width}
      height={computedHeight}
      priority={priority}
      className={cn("h-auto", className)}
    />
  );
}
