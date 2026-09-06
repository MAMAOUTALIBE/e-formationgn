export const PRESENTATION_COMPLETION_RATIO = 0.9;

export function mergeViewedSlideOrders(
  existing: readonly number[],
  viewedOrder: number,
): number[] {
  return [...new Set([...existing, viewedOrder])].sort((left, right) => left - right);
}

export function isPresentationComplete(input: {
  viewedSlideOrders: readonly number[];
  slideOrders: readonly number[];
  currentSlideOrder: number;
}): boolean {
  const validOrders = [...new Set(input.slideOrders)].sort((left, right) => left - right);
  const lastOrder = validOrders.at(-1);
  if (lastOrder === undefined || input.currentSlideOrder !== lastOrder) return false;

  const viewed = new Set(input.viewedSlideOrders);
  const visitedCount = validOrders.filter((order) => viewed.has(order)).length;
  return visitedCount >= Math.ceil(validOrders.length * PRESENTATION_COMPLETION_RATIO);
}

export function presentationSlideIndexForResume(
  slideOrders: readonly number[],
  lastSlideOrder: number | null | undefined,
): number {
  if (lastSlideOrder === null || lastSlideOrder === undefined) return 0;
  const index = slideOrders.indexOf(lastSlideOrder);
  return index >= 0 ? index : 0;
}

export function presentationHotspotLabel(input: {
  ariaLabel: string | null;
  kind: "EXTERNAL_URL" | "INTERNAL_SLIDE";
  externalUrl: string | null;
  targetSlideOrder: number | null;
}): string {
  const explicit = input.ariaLabel?.trim();
  if (explicit) return explicit;
  if (input.kind === "INTERNAL_SLIDE" && input.targetSlideOrder !== null) {
    return `Aller à la diapositive ${input.targetSlideOrder + 1}`;
  }
  if (input.externalUrl) {
    try {
      return `Ouvrir le lien vers ${new URL(input.externalUrl).hostname}`;
    } catch {
      // La DAL filtre déjà les URL, ce repli reste volontairement neutre.
    }
  }
  return "Ouvrir le lien de la diapositive";
}
