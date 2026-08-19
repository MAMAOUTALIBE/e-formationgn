import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Variant visuel.
   *   - default : couleur primaire (bleu marine), pour fond clair
   *   - light   : blanc, pour fond sombre
   *   - mark    : version compacte (G + point) pour favicons / très étroit
   */
  variant?: "default" | "light" | "mark";
  /** Taille en pixels (largeur visuelle approximative). Sert à dimensionner
   *  la font-size pour rester homogène avec les anciens usages. */
  width?: number;
  className?: string;
  /** Charge l'image prioritairement dans les zones au-dessus de la ligne de flottaison. */
  priority?: boolean;
  /** Hauteur maximale optionnelle. */
  height?: number;
}

export function Logo({
  variant = "default",
  width = 160,
  className,
  priority = false,
  height,
}: LogoProps) {
  if (variant === "mark") {
    return (
      <span
        className={cn(
          "inline-flex aspect-square items-center justify-center rounded-xl bg-white text-xl font-extrabold text-[color:var(--brand-primary)]",
          className,
        )}
        style={{ width: `${Math.min(width, 48)}px` }}
        aria-label={BRAND.name}
      >
        A
      </span>
    );
  }

  return (
    // Le fichier est le logo officiel publié par Aiduca. Il reste distant afin
    // de ne pas dupliquer une marque tierce dans le dépôt.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND.logoUrl}
      alt={BRAND.name}
      width={width}
      height={height ?? Math.round(width * 0.45)}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className={cn(
        "block h-auto max-h-14 w-auto object-contain",
        variant === "light" && "rounded-md bg-white px-1",
        className,
      )}
    />
  );
}
