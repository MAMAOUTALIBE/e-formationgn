import "server-only";

// File « À traiter maintenant » du tableau de bord.
//
// Les pastilles de la barre latérale disent COMBIEN de choses attendent ; elles
// ne disent pas laquelle ouvrir en premier. Cette requête ramène les éléments
// eux-mêmes, de six sources, et les ordonne en une seule liste : d'abord ce qui
// coûte de l'argent ou tient à un délai légal, ensuite ce qui est simplement en
// attente — et à poids égal, le plus ancien d'abord.

import { formatMinor } from "@/lib/payments/currency";
import { prisma } from "@/lib/prisma";

export type ActionQueueKind =
  | "dispute"
  | "ticket"
  | "gdpr"
  | "course"
  | "report"
  | "payout";

export interface ActionQueueItem {
  id: string;
  kind: ActionQueueKind;
  /** Libellé du type, affiché sous le titre. */
  kindLabel: string;
  title: string;
  href: string;
  createdAt: Date;
  /** L'élément a dépassé son délai de traitement raisonnable. */
  overdue: boolean;
}

export interface AdminActionQueue {
  /** Éléments ordonnés, plafonnés à `limit`. */
  items: ActionQueueItem[];
  /** Total réel toutes sources confondues (sert au « +N »). */
  totalCount: number;
}

/**
 * Poids de priorité, du plus urgent au moins urgent.
 *
 * Un litige immobilise un paiement et court contre les délais de contestation
 * du PSP ; une demande RGPD court contre un délai légal de 30 jours. Les deux
 * passent donc devant une modération de cours, qui ne fait que retarder une
 * publication.
 */
const KIND_WEIGHT: Record<ActionQueueKind, number> = {
  dispute: 0,
  gdpr: 1,
  ticket: 2,
  report: 3,
  course: 4,
  payout: 5,
};

const KIND_LABEL: Record<ActionQueueKind, string> = {
  dispute: "Litige ouvert",
  gdpr: "Demande RGPD",
  ticket: "Ticket support",
  report: "Signalement",
  course: "Cours à modérer",
  payout: "Versement en attente",
};

/** Au-delà de ce délai, l'élément est signalé comme « en retard ». */
const OVERDUE_DAYS: Record<ActionQueueKind, number> = {
  dispute: 3,
  gdpr: 25, // le délai légal est de 30 jours : on alerte avant, pas après
  ticket: 2,
  report: 3,
  course: 3,
  payout: 7,
};

function isOverdue(kind: ActionQueueKind, since: Date): boolean {
  const ageMs = Date.now() - since.getTime();
  return ageMs > OVERDUE_DAYS[kind] * 24 * 60 * 60 * 1000;
}

/** Nombre d'éléments ramenés PAR SOURCE avant fusion et tri. */
const PER_SOURCE = 10;

export async function getAdminActionQueue(limit = 8): Promise<AdminActionQueue> {
  const [
    disputes,
    gdprRequests,
    tickets,
    reports,
    courses,
    payouts,
    disputeCount,
    gdprCount,
    ticketCount,
    reportCount,
    courseCount,
    payoutCount,
  ] = await Promise.all([
    prisma.dispute.findMany({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      select: { id: true, reason: true, orderId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: PER_SOURCE,
    }),
    prisma.gdprRequest.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        kind: true,
        requestedAt: true,
        user: { select: { email: true } },
      },
      orderBy: { requestedAt: "asc" },
      take: PER_SOURCE,
    }),
    prisma.supportTicket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { id: true, subject: true, priority: true, createdAt: true },
      // Priorité décroissante puis ancienneté : un ticket URGENT récent doit
      // remonter avant un ticket LOW qui traîne.
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: PER_SOURCE,
    }),
    prisma.report.findMany({
      where: { status: "PENDING" },
      select: { id: true, reason: true, targetType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: PER_SOURCE,
    }),
    prisma.course.findMany({
      where: { status: "PENDING_REVIEW" },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: PER_SOURCE,
    }),
    prisma.payout.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        amountCents: true,
        currency: true,
        createdAt: true,
        instructor: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
      take: PER_SOURCE,
    }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.gdprRequest.count({ where: { status: "PENDING" } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.course.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.payout.count({ where: { status: "PENDING" } }),
  ]);

  const items: ActionQueueItem[] = [
    ...disputes.map((d) => ({
      id: `dispute-${d.id}`,
      kind: "dispute" as const,
      kindLabel: KIND_LABEL.dispute,
      title: truncate(d.reason, 90),
      href: "/admin/support/litiges",
      createdAt: d.createdAt,
      overdue: isOverdue("dispute", d.createdAt),
    })),
    ...gdprRequests.map((g) => ({
      id: `gdpr-${g.id}`,
      kind: "gdpr" as const,
      kindLabel: KIND_LABEL.gdpr,
      title: `${g.kind === "DELETE" ? "Suppression" : "Export"} des données — ${g.user.email}`,
      href: "/admin/securite/rgpd",
      createdAt: g.requestedAt,
      overdue: isOverdue("gdpr", g.requestedAt),
    })),
    ...tickets.map((t) => ({
      id: `ticket-${t.id}`,
      kind: "ticket" as const,
      kindLabel:
        t.priority === "URGENT" || t.priority === "HIGH"
          ? `${KIND_LABEL.ticket} · priorité ${t.priority === "URGENT" ? "urgente" : "haute"}`
          : KIND_LABEL.ticket,
      title: truncate(t.subject, 90),
      href: `/admin/support/tickets/${t.id}`,
      createdAt: t.createdAt,
      overdue: isOverdue("ticket", t.createdAt),
    })),
    ...reports.map((r) => ({
      id: `report-${r.id}`,
      kind: "report" as const,
      kindLabel: KIND_LABEL.report,
      title: `${REPORT_REASON_LABEL[r.reason] ?? r.reason} — ${REPORT_TARGET_LABEL[r.targetType] ?? r.targetType}`,
      href: "/admin/moderation/signalements",
      createdAt: r.createdAt,
      overdue: isOverdue("report", r.createdAt),
    })),
    ...courses.map((c) => ({
      id: `course-${c.id}`,
      kind: "course" as const,
      kindLabel: KIND_LABEL.course,
      title: truncate(c.title, 90),
      href: `/admin/cours/${c.id}`,
      createdAt: c.updatedAt,
      overdue: isOverdue("course", c.updatedAt),
    })),
    ...payouts.map((p) => ({
      id: `payout-${p.id}`,
      kind: "payout" as const,
      kindLabel: KIND_LABEL.payout,
      title: `${formatMinor(p.amountCents, p.currency)} — ${p.instructor.name ?? p.instructor.email}`,
      href: "/admin/finances/payouts?status=PENDING",
      createdAt: p.createdAt,
      overdue: isOverdue("payout", p.createdAt),
    })),
  ];

  // Tri final en mémoire : les six sources sont déjà plafonnées à 10, donc on
  // trie au plus 60 lignes — inutile de faire porter ça à Postgres via une
  // union, qui ne saurait de toute façon pas exprimer ce classement métier.
  items.sort((a, b) => {
    // Un élément en retard passe devant, quel que soit son type : c'est le
    // signal que le délai de traitement est déjà dépassé.
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const weightDiff = KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind];
    if (weightDiff !== 0) return weightDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return {
    items: items.slice(0, limit),
    totalCount:
      disputeCount + gdprCount + ticketCount + reportCount + courseCount + payoutCount,
  };
}

const REPORT_REASON_LABEL: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harcèlement",
  COPYRIGHT: "Droit d'auteur",
  INAPPROPRIATE: "Contenu inapproprié",
  OTHER: "Autre motif",
};

const REPORT_TARGET_LABEL: Record<string, string> = {
  COURSE: "cours",
  REVIEW: "avis",
  QUESTION: "question",
  ANSWER: "réponse",
  USER: "utilisateur",
};

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
