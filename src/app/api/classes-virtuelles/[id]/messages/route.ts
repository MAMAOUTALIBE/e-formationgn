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
    where: { virtualClassId: id, deletedAt: null },
    select: { id: true, content: true, type: true, createdAt: true, authorId: true, author: { select: { name: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: "asc" },
    take: 250,
  });
  return NextResponse.json({ messages: messages.map((message) => ({ ...message, authorName: virtualClassPersonName(message.author), mine: message.authorId === session.user.id })) }, { headers: { "cache-control": "private, no-store" } });
}
