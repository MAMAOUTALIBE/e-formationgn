// Patterns SVG génératifs "AI/tech" — fonds décoratifs pour CategoryCard.
// 6 variantes : neural network, code matrix, circuit, wave/particles, data, mesh.

interface CategoryPatternProps {
  variant: number;
  className?: string;
}

export function CategoryPattern({ variant, className }: CategoryPatternProps) {
  const Pattern = PATTERNS[variant % PATTERNS.length];
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <Pattern />
    </svg>
  );
}

const PATTERNS = [
  NeuralPattern,
  CodePattern,
  CircuitPattern,
  ParticlePattern,
  DataPattern,
  MeshPattern,
];

function NeuralPattern() {
  // Réseau de neurones : 3 colonnes de nodes reliés.
  const cols = [
    { x: 60, ys: [60, 130, 200, 260] },
    { x: 200, ys: [80, 160, 240] },
    { x: 340, ys: [100, 180] },
  ];
  return (
    <g stroke="white" strokeOpacity="0.35" fill="white" fillOpacity="0.7">
      {cols.slice(0, -1).map((col, ci) =>
        col.ys.map((y) =>
          cols[ci + 1].ys.map((y2) => (
            <line
              key={`${ci}-${y}-${y2}`}
              x1={col.x}
              y1={y}
              x2={cols[ci + 1].x}
              y2={y2}
              strokeWidth="1"
            />
          )),
        ),
      )}
      {cols.flatMap((col) =>
        col.ys.map((y) => (
          <circle key={`${col.x}-${y}`} cx={col.x} cy={y} r="6" />
        )),
      )}
    </g>
  );
}

function CodePattern() {
  // "Matrix" : barres verticales de longueurs variées.
  const bars = Array.from({ length: 24 }, (_, i) => ({
    x: 16 + i * 16,
    h: 30 + ((i * 37) % 220),
    o: 0.15 + ((i * 13) % 30) / 100,
  }));
  return (
    <g fill="white">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={(300 - b.h) / 2}
          width="6"
          height={b.h}
          fillOpacity={b.o}
          rx="2"
        />
      ))}
    </g>
  );
}

function CircuitPattern() {
  // Lignes qui se croisent à angle droit + petits carrés (chips).
  const lines = [
    "M 0 80 L 120 80 L 120 40 L 240 40 L 240 130 L 380 130",
    "M 60 0 L 60 160 L 200 160 L 200 240 L 340 240 L 340 300",
    "M 0 220 L 80 220 L 80 280 L 280 280",
  ];
  const chips = [
    [120, 80],
    [240, 130],
    [60, 160],
    [200, 240],
    [340, 240],
    [80, 280],
  ];
  return (
    <g stroke="white" strokeOpacity="0.4" fill="none" strokeWidth="1.5">
      {lines.map((d, i) => (
        <path key={i} d={d} />
      ))}
      <g fill="white" fillOpacity="0.7" stroke="none">
        {chips.map(([x, y], i) => (
          <rect key={i} x={x - 4} y={y - 4} width="8" height="8" rx="1" />
        ))}
      </g>
    </g>
  );
}

function ParticlePattern() {
  // Nuage de particules en distribution pseudo-aléatoire.
  const particles = Array.from({ length: 60 }, (_, i) => ({
    x: ((i * 67) % 400) + ((i * 23) % 13),
    y: ((i * 41) % 300) + ((i * 11) % 7),
    r: 1 + ((i * 7) % 3),
    o: 0.3 + ((i * 17) % 50) / 100,
  }));
  return (
    <g fill="white">
      {particles.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fillOpacity={p.o} />
      ))}
    </g>
  );
}

function DataPattern() {
  // Graphique : barres + courbe ascendante.
  const bars = [
    [40, 70, 60],
    [80, 90, 80],
    [120, 60, 110],
    [160, 100, 70],
    [200, 50, 130],
    [240, 80, 90],
    [280, 40, 150],
    [320, 70, 110],
    [360, 30, 170],
  ] as const;
  return (
    <g>
      <g fill="white" fillOpacity="0.4">
        {bars.map(([x, , h], i) => (
          <rect key={i} x={x} y={300 - h - 30} width="20" height={h} rx="2" />
        ))}
      </g>
      <path
        d="M 50 220 Q 90 200 130 180 T 210 130 T 290 90 T 370 60"
        stroke="white"
        strokeOpacity="0.7"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function MeshPattern() {
  // Cercles flous superposés (gradient mesh).
  return (
    <g>
      <defs>
        <radialGradient id="mesh-c1">
          <stop offset="0%" stopColor="white" stopOpacity="0.7" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-c2">
          <stop offset="0%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="100" fill="url(#mesh-c1)" />
      <circle cx="320" cy="120" r="120" fill="url(#mesh-c2)" />
      <circle cx="200" cy="240" r="90" fill="url(#mesh-c1)" />
      <circle cx="60" cy="240" r="70" fill="url(#mesh-c2)" />
    </g>
  );
}
