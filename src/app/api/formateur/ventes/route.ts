import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { minorToAmount } from "@/lib/payments/currency";
import { prisma } from "@/lib/prisma";

// Export CSV des ventes du formateur (lignes de commande payées).
// Réservé au formateur (ses propres ventes) ou à un admin.

export const runtime = "nodejs";

function csvCell(value: string): string {
  // Échappe si le champ contient séparateur, guillemet ou saut de ligne.
  if (/["\n\r,;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Réservé aux formateurs." }, { status: 403 });
  }

  const items = await prisma.orderItem.findMany({
    where: {
      course: { instructorId: session.user.id },
      order: { status: "PAID" },
    },
    include: {
      course: { select: { title: true } },
      order: { select: { id: true, paidAt: true } },
    },
    orderBy: { order: { paidAt: "desc" } },
  });

  const header = [
    "Date",
    "Cours",
    "Devise",
    "Montant total",
    "Commission plateforme",
    "Revenu net",
    "ID commande",
  ];

  const rows = items.map((it) =>
    [
      it.order.paidAt ? it.order.paidAt.toISOString().slice(0, 10) : "",
      csvCell(it.course.title),
      it.currency,
      String(minorToAmount(it.totalCents, it.currency)),
      String(minorToAmount(it.platformFeeCents, it.currency)),
      String(minorToAmount(it.instructorPayoutCents, it.currency)),
      it.order.id,
    ].join(","),
  );

  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  const csv = "﻿" + [header.join(","), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="ventes-eformationgn.csv"',
      "cache-control": "no-store",
    },
  });
}
