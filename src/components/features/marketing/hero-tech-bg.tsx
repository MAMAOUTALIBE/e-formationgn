// Fond « IA / tech » du hero, 100% vectoriel (SVG + CSS) — évoque les visuels
// d'IA (réseau de circuits, nœuds lumineux, glow) aux couleurs de la marque,
// sans dépendre d'une image externe ni de droits stock.
//
// Décoratif (aria-hidden). Le texte du hero reste lisible grâce au dégradé
// sombre + voile.

export function HeroTechBackground() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      {/* 1. Base : dégradé sombre brand → near-black */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #1E3A8A 0%, #4C1D95 45%, #0B1220 100%)",
        }}
      />

      {/* 2. Glows doux (accent ciel + menthe + violet) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(40% 60% at 78% 30%, rgba(14,165,233,0.35) 0%, transparent 60%)," +
            "radial-gradient(35% 50% at 18% 75%, rgba(146,246,161,0.18) 0%, transparent 60%)," +
            "radial-gradient(45% 55% at 50% 50%, rgba(124,58,237,0.25) 0%, transparent 65%)",
        }}
      />

      {/* 3. Grille de points fine (effet circuit) */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(80% 80% at 50% 40%, #000 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(80% 80% at 50% 40%, #000 30%, transparent 100%)",
        }}
      />

      {/* 4. Réseau de circuits + nœuds lumineux (SVG) */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 480"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>

        {/* Anneau « cœur IA » (haut-droite) */}
        <g
          stroke="url(#hero-line)"
          strokeOpacity="0.6"
          filter="url(#hero-glow)"
        >
          <circle cx="980" cy="120" r="78" strokeWidth="2" strokeDasharray="6 10" />
          <circle cx="980" cy="120" r="54" strokeWidth="1.5" strokeOpacity="0.4" />
        </g>

        {/* Lignes de connexion */}
        <g stroke="url(#hero-line)" strokeWidth="1.5" strokeOpacity="0.45">
          <path d="M980 198 L980 300 L820 300" />
          <path d="M902 120 L760 120 L760 220" />
          <path d="M1058 120 L1140 120" />
          <path d="M150 360 L320 360 L320 260 L470 260" />
          <path d="M150 200 L260 200 L260 120" />
        </g>

        {/* Nœuds carrés (icônes) */}
        <g fill="#0B1220" stroke="url(#hero-line)" strokeWidth="1.5">
          <rect x="740" y="200" width="40" height="40" rx="8" strokeOpacity="0.6" />
          <rect x="800" y="280" width="40" height="40" rx="8" strokeOpacity="0.6" />
          <rect x="450" y="240" width="40" height="40" rx="8" strokeOpacity="0.6" />
          <rect x="240" y="80" width="40" height="40" rx="8" strokeOpacity="0.6" />
          <rect x="130" y="340" width="40" height="40" rx="8" strokeOpacity="0.6" />
        </g>

        {/* Points lumineux (twinkle léger) */}
        <g fill="#92F6A1" filter="url(#hero-glow)">
          <circle cx="980" cy="42" r="4">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="1140" cy="120" r="3" fill="#0EA5E9">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="470" cy="260" r="3" fill="#0EA5E9">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="3.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="260" cy="120" r="3">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>

      {/* 5. Voile pour garantir la lisibilité du texte */}
      <div className="absolute inset-0 bg-[color:var(--brand-primary)]/20" />
    </div>
  );
}
