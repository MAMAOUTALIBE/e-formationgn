import { NextResponse } from "next/server";

import { AuthorizationError, requireAnyAdminRole } from "@/lib/auth/authorization";
import { formatDurationSeconds, virtualClassPersonName } from "@/lib/virtual-class-display";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyAdminRole("ADMIN", "MANAGER");
    const { id } = await params;
    const virtualClass = await prisma.virtualClassSession.findUnique({
      where: { id },
      select: {
        title: true,
        attendances: {
          where: { role: "STUDENT" },
          include: { user: { select: { name: true, firstName: true, lastName: true, email: true } } },
          orderBy: { user: { name: "asc" } },
        },
      },
    });
    if (!virtualClass) return NextResponse.json({ error: "Classe virtuelle introuvable." }, { status: 404 });
    const lines = [
      ["Participant", "E-mail", "Statut", "Nombre de connexions", "Durée réelle", "Première entrée", "Dernière sortie"],
      ...virtualClass.attendances.map((attendance) => [
        virtualClassPersonName(attendance.user), attendance.user.email, attendance.status,
        attendance.connectionCount, formatDurationSeconds(attendance.totalSeconds),
        attendance.firstJoinedAt?.toISOString() ?? "", attendance.lastLeftAt?.toISOString() ?? "",
      ]),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map(cell).join(";")).join("\n")}`;
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="presence-${id}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "UNAUTHENTICATED" ? 401 : 403 });
    }
    return NextResponse.json({ error: "Export impossible." }, { status: 500 });
  }
}
