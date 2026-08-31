import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { virtualClassPersonName } from "@/lib/virtual-class-display";
import { getVirtualClassViewer } from "@/server/queries/virtual-classes";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { id } = await params;
  const viewer = await getVirtualClassViewer(id, session.user.id, session.user.role);
  if (!viewer) return NextResponse.json({ error: "Classe virtuelle introuvable." }, { status: 404 });
  const messages = await prisma.virtualClassMessage.findMany({
    where: {
      virtualClassId: id,
      deletedAt: null,
      // `visibleAfterClass` n'était lu nulle part : une fois la séance
      // terminée, toute la discussion restait lisible par les apprenants, y
      // compris les échanges qui n'ont de sens que pendant le direct. Les
      // modérateurs, eux, gardent l'historique complet.
      ...(viewer.viewerRole === "STUDENT" && viewer.status === "ENDED"
        ? { visibleAfterClass: true }
        : {}),
    },
    select: { id: true, content: true, type: true, createdAt: true, authorId: true, author: { select: { name: true, firstName: true, lastName: true, email: true } } },
    // Les 250 messages les PLUS RÉCENTS, réordonnés ensuite pour l'affichage.
    // Un tri ascendant renvoyait les 250 premiers : passé ce seuil, la
    // discussion se figeait et aucun nouveau message n'apparaissait plus.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 250,
  });
  messages.reverse();
  return NextResponse.json({
    messages: messages.map((message) => ({
      ...message,
      authorName: virtualClassPersonName(message.author),
      mine: message.authorId === session.user.id,
    })),
    canModerate: viewer.viewerRole !== "STUDENT",
  }, { headers: { "cache-control": "private, no-store" } });
}
