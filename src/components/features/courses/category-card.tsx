import Link from "next/link";
import * as Icons from "lucide-react";
import { createElement } from "react";

import { CategoryPattern } from "@/components/features/courses/category-pattern";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format/labels";
import type { CategoryWithCount } from "@/server/queries/categories";

interface CategoryCardProps {
  category: CategoryWithCount;
  variant?: number;
  className?: string;
}

const VARIANTS = [
  // 0 — Violet (neural network)
  "bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#1e3a8a]",
  // 1 — Bleu marine (code matrix)
  "bg-gradient-to-br from-[#1e3a8a] via-[#2563eb] to-[#1e40af]",
  // 2 — Cyan (circuit)
  "bg-gradient-to-br from-[#0ea5e9] via-[#0284c7] to-[#1e3a8a]",
  // 3 — Émeraude/menthe (particles)
  "bg-gradient-to-br from-[#10b981] via-[#059669] to-[#047857]",
  // 4 — Rose (data)
  "bg-gradient-to-br from-[#db2777] via-[#9333ea] to-[#5b21b6]",
  // 5 — Ambre (mesh)
  "bg-gradient-to-br from-[#f59e0b] via-[#db2777] to-[#7c3aed]",
];

export function CategoryCard({
  category,
  variant = 0,
  className,
}: CategoryCardProps) {
  const courseCount = category._count?.courses ?? 0;
  const IconComponent = resolveIcon(category.iconName);
  const v = VARIANTS[variant % VARIANTS.length];

  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        "group relative flex h-full min-h-[180px] flex-col justify-end overflow-hidden rounded-xl text-white shadow-md transition-all hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        v,
        className,
      )}
    >
      {/* Pattern SVG décoratif IA/tech */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 transition-opacity group-hover:opacity-80"
      >
        <CategoryPattern variant={variant} className="h-full w-full" />
      </div>

      {/* Voile sombre pour lisibilité du texte */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
      />

      {/* Icône en haut à droite */}
      <div className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30 transition-transform group-hover:scale-110">
        {createElement(IconComponent, {
          className: "h-5 w-5 text-white",
          "aria-hidden": true,
        })}
      </div>

      {/* Contenu en bas */}
      <div className="relative p-4">
        <h3 className="text-base font-semibold leading-tight tracking-tight drop-shadow-sm">
          {category.name}
        </h3>
        {category.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-white/85">
            {category.description}
          </p>
        ) : null}
        <p className="mt-2 text-xs font-medium text-white/90">
          {courseCount} {pluralize(courseCount, "formation", "formations")}
        </p>
      </div>
    </Link>
  );
}

function resolveIcon(name: string | null | undefined): Icons.LucideIcon {
  if (!name) return Icons.Folder;
  const candidate = (Icons as unknown as Record<string, Icons.LucideIcon | undefined>)[name];
  return candidate ?? Icons.Folder;
}
