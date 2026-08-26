"use client";

import { EllipsisVertical } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { computeAdminActionMenuLayout, type AdminActionMenuLayout } from "@/lib/admin-action-menu-layout";

const OPEN_EVENT = "admin-action-menu-open";

export function AdminActionMenu({
  triggerLabel,
  menuLabel,
  widthClass = "w-56",
  children,
}: {
  triggerLabel: string;
  menuLabel: string;
  widthClass?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [layout, setLayout] = useState<AdminActionMenuLayout>({ mode: "mobile", style: {} });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 260;
    setLayout(computeAdminActionMenuLayout({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      trigger: rect,
      menuHeight: height,
    }));
  }, []);

  useEffect(() => {
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) close();
    };
    window.addEventListener(OPEN_EVENT, closeOther);
    return () => window.removeEventListener(OPEN_EVENT, closeOther);
  }, [close, id]);
  useEffect(() => {
    if (!open) return;
    positionMenu();
    const menu = menuRef.current;
    const items = () => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    items()[0]?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); close(); triggerRef.current?.focus(); return;
      }
      if (event.key === "Tab") { close(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const available = items();
      if (!available.length) return;
      event.preventDefault();
      const current = available.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? available.length - 1
        : event.key === "ArrowDown" ? (current + 1) % available.length
          : (current <= 0 ? available.length : current) - 1;
      available[next]?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [close, open, positionMenu]);

  return (
    <>
      <button ref={triggerRef} type="button" aria-label={triggerLabel} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen((value) => { const next = !value; if (next) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id })); return next; })}>
        <EllipsisVertical className="h-4 w-4" aria-hidden />
      </button>
      {mounted && open ? createPortal(
        <>
          {/* Voile mobile : la feuille occupe toute la largeur, le contenu qui
              défile derrière la rendait difficile à lire. Masqué au-delà de
              `sm`, où le menu est un petit calque ancré sur son déclencheur. */}
          <div aria-hidden data-testid="admin-action-menu-scrim" className="fixed inset-0 z-[99] bg-slate-950/40 sm:hidden" />
          <div ref={menuRef} role="menu" aria-label={menuLabel} style={layout.style}
            data-layout={layout.mode}
            className={`fixed inset-x-3 bottom-3 z-[100] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-left text-sm text-popover-foreground shadow-2xl ring-1 ring-black/5 dark:ring-white/10 sm:inset-x-auto sm:bottom-auto ${widthClass}`}>
            {children(close)}
          </div>
        </>,
        document.body,
      ) : null}
    </>
  );
}
