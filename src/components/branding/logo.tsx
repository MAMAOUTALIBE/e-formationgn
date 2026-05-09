import { cn } from "@/lib/utils";

// Wordmark "Gandal" — style typographique inspiré d'Udemy : un mot court,
// graisse forte, légèrement italique, couleur primaire de la marque.
//
// "Gandal" signifie « savoir / connaissance » en peul (langue parlée en
// Guinée et en Afrique de l'Ouest francophone). Choix de marque qui
// reflète la mission pédagogique de la plateforme.

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
  /** Compat ascendante avec l'ancien Logo image — sans effet sur le wordmark. */
  priority?: boolean;
  /** Compat ascendante — ignoré. */
  height?: number;
}

const VARIANT_CLASS: Record<NonNullable<LogoProps["variant"]>, string> = {
  default: "text-[color:var(--brand-primary)]",
  light: "text-white",
  mark: "text-[color:var(--brand-primary)]",
};

export function Logo({
  variant = "default",
  width = 160,
  className,
}: LogoProps) {
  // Mapping width pixel → font-size pixel pour préserver une empreinte
  // visuelle équivalente à l'ancien logo image (160 px ≈ 28 px de glyphes).
  const fontSize = Math.max(16, Math.round(width * 0.18));
  const dotSize = Math.max(4, Math.round(fontSize * 0.18));

  return (
    <span
      className={cn(
        "inline-flex items-baseline font-extrabold italic leading-none tracking-tight",
        VARIANT_CLASS[variant],
        className,
      )}
      style={{ fontSize: `${fontSize}px` }}
      aria-label="Gandal"
    >
      {variant === "mark" ? "G" : "Gandal"}
      <span
        aria-hidden
        className="ml-0.5 inline-block rounded-full bg-[color:var(--brand-mint)]"
        style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
      />
    </span>
  );
}
