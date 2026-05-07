"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface CourseEditorTabsProps {
  courseId: string;
}

export function CourseEditorTabs({ courseId }: CourseEditorTabsProps) {
  const pathname = usePathname();

  const tabs = [
    { href: `/formateur/cours/${courseId}`, label: "Général" },
    { href: `/formateur/cours/${courseId}/programme`, label: "Programme" },
    { href: `/formateur/cours/${courseId}/tarification`, label: "Tarification" },
    { href: `/formateur/cours/${courseId}/seo`, label: "SEO & Objectifs" },
  ];

  return (
    <nav className="border-b border-border">
      <ul className="flex flex-wrap gap-1 overflow-x-auto" role="tablist">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== `/formateur/cours/${courseId}` && pathname.startsWith(tab.href));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "inline-flex h-10 items-center whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors",
                  isActive
                    ? "border-[color:var(--brand-primary)] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
