"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { usePathname } from "next/navigation";

import { resolveThemeScope, themeStorageKey } from "@/lib/theme-scope";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scope = resolveThemeScope(pathname);

  return (
    <NextThemesProvider
      // Le `key` force next-themes à relire la préférence de la nouvelle
      // surface lors d'une navigation public ↔ espace connecté. Sans lui,
      // l'état React du provider conserverait le thème de la route précédente.
      key={scope}
      attribute="class"
      storageKey={themeStorageKey(scope)}
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
