import "server-only";

// Émargement — agrégation du temps réellement passé, par session de formation.
//
// L'article L.6353-1 du Code du travail et le Référentiel national qualité
// demandent à l'organisme de justifier de la réalisation de l'action. Pour une
// formation à distance, la preuve est le temps de connexion effectif : c'est ce
// que mesure `LearningSession`, avec un battement de 20 s et un crédit plafonné
// à 45 s par intervalle, émis seulement lorsque l'onglet est visible et le
// contenu en cours de lecture. Ce n'est pas du « temps page ouverte ».
//
// Le rattachement à l'inscription est figé sur chaque session de suivi : deux
// sessions d'un même programme suivies par la même personne restent donc
// distinctes, ce qu'un contrôle exige.

import { formatDuree } from "@/lib/duration";
import { prisma } from "@/lib/prisma";

export interface AttendanceDay {
  /** Journée civile, à minuit, en heure de Paris. */
  jour: Date;
  secondes: number;
}

export interface AttendanceRow {
  registrationId: string;
  stagiaire: string;
  email: string;
  statut: string;
  journees: AttendanceDay[];
  totalSecondes: number;
  /** Vrai si aucun temps n'a été mesuré — l'absence doit se voir. */
  sansActivite: boolean;
}

export interface AttendanceSheet {
  sessionId: string;
  reference: string | null;
  programme: string;
  lieu: string | null;
  debut: Date;
  fin: Date;
  /** Journées distinctes où au moins un stagiaire a été actif. */
  colonnes: Date[];
  lignes: AttendanceRow[];
  totalSecondes: number;
  genereLe: Date;
}

/**
 * Construit la feuille d'émargement d'une session.
 *
 * Toutes les personnes inscrites y figurent, y compris celles qui ne se sont
 * jamais connectées : une feuille qui n'énumère que les présents ne prouve
 * rien. Les inscriptions annulées sont écartées.
 */
export async function buildAttendanceSheet(
  sessionId: string,
): Promise<AttendanceSheet | null> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      reference: true,
      startDate: true,
      endDate: true,
      location: true,
      program: { select: { title: true } },
      registrations: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          status: true,
          student: { select: { name: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { student: { name: "asc" } },
      },
    },
  });
  if (!session) return null;

  const registrationIds = session.registrations.map((r) => r.id);

  // Agrégation en SQL : le regroupement par journée civile relève de la base,
  // qui connaît le fuseau. Le faire en JavaScript exposerait au décalage entre
  // le fuseau du serveur et celui du centre — une séance du soir basculerait
  // au lendemain sur la feuille.
  const brut =
    registrationIds.length === 0
      ? []
      : await prisma.$queryRaw<Array<{ registrationId: string; jour: Date; secondes: bigint }>>`
          SELECT ls."registrationId"                                            AS "registrationId",
                 date_trunc('day', ls."startedAt" AT TIME ZONE 'Europe/Paris')  AS "jour",
                 SUM(ls."activeSeconds")::bigint                                AS "secondes"
          FROM   "LearningSession" ls
          WHERE  ls."registrationId" = ANY(${registrationIds}::text[])
            AND  ls."activeSeconds" > 0
          GROUP  BY ls."registrationId", "jour"
          ORDER  BY "jour" ASC
        `;

  const parInscription = new Map<string, AttendanceDay[]>();
  const joursVus = new Map<number, Date>();
  for (const ligne of brut) {
    const jour = new Date(ligne.jour);
    joursVus.set(jour.getTime(), jour);
    const liste = parInscription.get(ligne.registrationId) ?? [];
    liste.push({ jour, secondes: Number(ligne.secondes) });
    parInscription.set(ligne.registrationId, liste);
  }

  const lignes: AttendanceRow[] = session.registrations.map((r) => {
    const journees = parInscription.get(r.id) ?? [];
    const totalSecondes = journees.reduce((acc, j) => acc + j.secondes, 0);
    return {
      registrationId: r.id,
      stagiaire:
        r.student.name ??
        [r.student.firstName, r.student.lastName].filter(Boolean).join(" ") ??
        r.student.email,
      email: r.student.email,
      statut: r.status,
      journees,
      totalSecondes,
      sansActivite: totalSecondes === 0,
    };
  });

  return {
    sessionId: session.id,
    reference: session.reference,
    programme: session.program.title,
    lieu: session.location,
    debut: session.startDate,
    fin: session.endDate,
    colonnes: [...joursVus.values()].sort((a, b) => a.getTime() - b.getTime()),
    lignes,
    totalSecondes: lignes.reduce((acc, l) => acc + l.totalSecondes, 0),
    genereLe: new Date(),
  };
}

// Ré-exporté pour les appelants qui consomment déjà ce module.
export { formatDuree };
