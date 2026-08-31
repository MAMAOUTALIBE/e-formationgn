import "server-only";

import { attendanceStatusForDuration } from "@/lib/domain/virtual-class";
import { prisma } from "@/lib/prisma";

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Clôture les périodes de connexion restées ouvertes et recalcule la présence.
 *
 * Appelé depuis deux endroits volontairement redondants :
 *   - le webhook `room_finished`, chemin nominal ;
 *   - la fin (ou l'annulation) de séance déclenchée depuis l'interface.
 *
 * Sans le second, une présence dépendait entièrement de la bonne livraison du
 * webhook LiveKit : destination non déclarée dans le projet LiveKit, coupure
 * réseau ou 500 passagère et les périodes restaient ouvertes indéfiniment,
 * `totalSeconds` bloqué à sa valeur partielle et le statut jamais recalculé —
 * une feuille de présence fausse, sans le moindre signal d'erreur.
 *
 * L'opération est idempotente : elle ne voit que les périodes `leftAt: null`,
 * donc un second passage n'ajoute rien.
 */
export async function closeOpenAttendancePeriods(
  tx: Transaction,
  input: { virtualClassId: string; durationMinutes: number; at: Date; reason: string },
): Promise<{ closedPeriods: number }> {
  const attendances = await tx.virtualClassAttendance.findMany({
    where: { virtualClassId: input.virtualClassId },
    include: { connectionPeriods: { where: { leftAt: null } } },
  });

  let closedPeriods = 0;
  for (const attendance of attendances) {
    let added = 0;
    for (const period of attendance.connectionPeriods) {
      const durationSeconds = Math.max(
        0,
        Math.floor((input.at.getTime() - period.joinedAt.getTime()) / 1000),
      );
      added += durationSeconds;
      closedPeriods++;
      await tx.virtualClassConnectionPeriod.update({
        where: { id: period.id },
        data: { leftAt: input.at, durationSeconds, closeReason: input.reason },
      });
    }
    const totalSeconds = attendance.totalSeconds + added;
    // Le statut est recalculé même sans période à clôturer : une séance
    // terminée doit trancher entre PRESENT, PARTIAL et ABSENT pour tout le
    // monde, y compris ceux qui ne se sont jamais connectés.
    await tx.virtualClassAttendance.update({
      where: { id: attendance.id },
      data: {
        totalSeconds,
        lastLeftAt: added ? input.at : attendance.lastLeftAt,
        status: attendanceStatusForDuration(totalSeconds, input.durationMinutes * 60),
      },
    });
  }
  return { closedPeriods };
}
