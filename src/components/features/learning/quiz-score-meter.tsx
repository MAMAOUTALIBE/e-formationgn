// Score d'un quiz : un ratio unique confronté à un seuil.
//
// La forme retenue est un COMPTEUR (piste + remplissage), pas un anneau ni un
// camembert : le lecteur n'a pas à comparer des parts, il a une question
// binaire — « suis-je au-dessus de la barre ? » — et une seconde, graduelle —
// « de combien ? ». Une piste horizontale répond aux deux d'un coup d'œil,
// parce que le seuil peut y être marqué à sa place exacte. Un anneau oblige à
// estimer un angle, et la barre des 70 % n'y a nulle part où se poser.
//
// Deux états seulement, réussi ou échoué. Une échelle à trois niveaux avait
// été envisagée (vert / orange / rouge) : le rouge et l'orange de la charte
// se séparent de ΔE 14,4 en vision normale, sous le plancher de 15 — deux
// états que l'œil ne distingue pas ne sont pas deux états. Les deux couleurs
// conservées se séparent de 32.
//
// La couleur ne porte jamais seule : elle vient toujours avec une icône, une
// mention écrite et le nombre.

interface QuizScoreMeterProps {
  score: number;
  passingScore: number;
  passed: boolean;
  /** Meilleur score des tentatives précédentes, marqué sur la piste. */
  previousBest?: number | null;
}

const TRACK_HEIGHT = 14;

export function QuizScoreMeter({
  score,
  passingScore,
  passed,
  previousBest,
}: QuizScoreMeterProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const threshold = Math.max(0, Math.min(100, passingScore));
  // Marqué seulement s'il apporte une information : un record égal ou
  // inférieur au score courant n'ajoute rien et encombrerait la piste.
  const bestValue =
    typeof previousBest === "number" && previousBest > clamped
      ? Math.max(0, Math.min(100, previousBest))
      : null;

  // Un record proche du seuil — le cas le plus fréquent, celui de l'élève qui
  // bute juste sous la barre — collait son repère contre celui du seuil : deux
  // traits de 2 et 3 pixels séparés par 2 % de la piste, illisibles. Sous cet
  // écart on ne trace que le seuil, qui prime ; la valeur du record reste
  // donnée en toutes lettres dans la légende, où elle ne peut pas se
  // confondre.
  const MIN_MARKER_GAP = 5;
  const bestCollides =
    bestValue !== null && Math.abs(bestValue - threshold) < MIN_MARKER_GAP;
  const best = bestCollides ? null : bestValue;

  const fill = passed ? "var(--brand-success)" : "var(--destructive)";

  return (
    <div>
      <div
        role="img"
        aria-label={`Score ${clamped} sur 100. Seuil de réussite ${threshold} sur 100. ${
          passed ? "Quiz validé." : "Quiz non validé."
        }`}
        className="relative"
      >
        {/* Piste : un pas plus clair du même remplissage, pour que l'état se
            lise sur toute la largeur et pas seulement sur la partie remplie. */}
        <div
          className="w-full overflow-hidden rounded-full"
          style={{
            height: TRACK_HEIGHT,
            backgroundColor: fill,
            opacity: 0.16,
          }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          style={{ width: `${clamped}%`, backgroundColor: fill }}
        />

        {/* Seuil : un trait plein qui traverse la piste, avec un liseré de la
            couleur de surface pour rester lisible sur le remplissage comme
            sur la piste. */}
        <div
          className="absolute inset-y-[-4px] w-[3px] rounded-full bg-foreground ring-2 ring-[color:var(--card)]"
          style={{ left: `calc(${threshold}% - 1.5px)` }}
          aria-hidden
        />

        {best !== null ? (
          <div
            className="absolute inset-y-[-1px] w-[2px] bg-muted-foreground ring-2 ring-[color:var(--card)]"
            style={{ left: `calc(${best}% - 1px)` }}
            aria-hidden
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded-sm bg-foreground"
            aria-hidden
          />
          Seuil de réussite · {threshold} / 100
        </span>
        {bestValue !== null ? (
          <span className="inline-flex items-center gap-1.5">
            {best !== null ? (
              <span
                className="inline-block h-2 w-2.5 rounded-sm bg-muted-foreground"
                aria-hidden
              />
            ) : null}
            Votre record · {bestValue} / 100
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Historique des tentatives — une barre par essai, dans l'ordre chronologique.
 *
 * Volontairement pas un graphique en courbe : trois ou quatre points ne
 * dessinent pas une tendance, et une courbe le laisserait croire. Des barres
 * comparent des grandeurs, ce qui est exactement le travail demandé.
 */
export function QuizAttemptHistory({
  attempts,
  passingScore,
}: {
  attempts: Array<{ id: string; attemptNumber: number; score: number; passed: boolean }>;
  passingScore: number;
}) {
  if (attempts.length === 0) return null;
  const ordered = [...attempts].sort((a, b) => a.attemptNumber - b.attemptNumber);

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Vos tentatives
      </p>
      <ol className="space-y-1.5">
        {ordered.map((attempt) => (
          <li key={attempt.id} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
              #{attempt.attemptNumber}
            </span>
            <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, attempt.score))}%`,
                  backgroundColor: attempt.passed
                    ? "var(--brand-success)"
                    : "var(--destructive)",
                }}
              />
              <span
                className="absolute inset-y-0 w-px bg-foreground/50"
                style={{ left: `${Math.max(0, Math.min(100, passingScore))}%` }}
                aria-hidden
              />
            </span>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-foreground">
              {attempt.score} / 100
            </span>
            <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
              {attempt.passed ? "Réussie" : "Échouée"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
