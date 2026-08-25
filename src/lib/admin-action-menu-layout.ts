export type AdminActionMenuLayout =
  | { mode: "mobile"; style: Record<string, never> }
  | { mode: "desktop"; style: { top: number; right: number } };

export function computeAdminActionMenuLayout(input: {
  viewportWidth: number;
  viewportHeight: number;
  trigger: { top: number; right: number; bottom: number };
  menuHeight: number;
}): AdminActionMenuLayout {
  if (input.viewportWidth < 640) return { mode: "mobile", style: {} };
  const below = input.trigger.bottom + 4;
  return {
    mode: "desktop",
    style: {
      top: below + input.menuHeight <= input.viewportHeight - 8
        ? below
        : Math.max(8, input.trigger.top - input.menuHeight - 4),
      right: Math.max(8, input.viewportWidth - input.trigger.right),
    },
  };
}
