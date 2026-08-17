"use client";

// Raccourcis clavier "g + lettre" pour navigation rapide dans l'admin.
// On suit le pattern Linear/Gmail : presser g puis une lettre dans les 1.5s.
// Désactivé si l'utilisateur tape dans un input/textarea.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const SHORTCUTS: Record<string, { href: string; label: string }> = {
  d: { href: "/admin", label: "Dashboard" },
  u: { href: "/admin/utilisateurs", label: "Apprenants" },
  i: { href: "/admin/equipe", label: "Équipe interne" },
  c: { href: "/admin/cours", label: "Cours" },
  m: { href: "/admin/marketing", label: "Marketing" },
  s: { href: "/admin/support", label: "Support" },
  o: { href: "/admin/moderation", label: "Modération" },
  p: { href: "/admin/parametres", label: "Paramètres" },
  e: { href: "/admin/securite", label: "Sécurité" },
  a: { href: "/admin/analytics", label: "Analytics" },
};

const COMBO_TIMEOUT_MS = 1500;

export function AdminKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let pending: NodeJS.Timeout | null = null;
    let waitingForLetter = false;

    function isTyping(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable
      );
    }

    function handleKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      if (waitingForLetter) {
        const route = SHORTCUTS[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          router.push(route.href);
        }
        waitingForLetter = false;
        if (pending) clearTimeout(pending);
        return;
      }

      if (e.key === "g" || e.key === "G") {
        waitingForLetter = true;
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
          waitingForLetter = false;
        }, COMBO_TIMEOUT_MS);
        return;
      }

      // Ctrl/Cmd + / → afficher un toast d'aide
      if (e.key === "?") {
        e.preventDefault();
        showHelpToast();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (pending) clearTimeout(pending);
    };
  }, [router]);

  return null;
}

async function showHelpToast() {
  const { toast } = await import("sonner");
  toast.info(
    "Raccourcis : g+d Dashboard · g+u Apprenants · g+c Cours · g+m Communication · g+s Support · g+o Modération · ⌘K Recherche",
    { duration: 8000 },
  );
}
