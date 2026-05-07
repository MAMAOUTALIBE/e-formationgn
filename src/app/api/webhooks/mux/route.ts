// Webhook Mux — réception et vérification de signature.
//
// Mux signe chaque payload avec MUX_WEBHOOK_SECRET. On utilise la méthode
// `webhooks.unwrap()` du SDK qui valide la signature ET parse l'événement.
//
// Événements traités :
// - `video.asset.ready`    : la vidéo est encodée et lisible → on stocke
//   playbackId + durée sur la leçon associée.
// - `video.asset.errored`  : on remet la leçon dans un état "à réuploader".
// - `video.upload.asset_created` : un upload direct est associé à un asset.

import { NextResponse } from "next/server";

import { getMuxClient, isMuxConfigured } from "@/lib/mux";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!isMuxConfigured()) {
    return NextResponse.json({ error: "mux_not_configured" }, { status: 503 });
  }

  const body = await request.text();

  let event: { type?: string; data?: unknown };
  try {
    const mux = getMuxClient();
    event = (await mux.webhooks.unwrap(body, request.headers)) as {
      type?: string;
      data?: unknown;
    };
  } catch (error) {
    console.warn("[mux-webhook] Signature invalide", error);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  switch (event.type) {
    case "video.upload.asset_created": {
      // Un upload direct vient d'être lié à un asset.
      const data = event.data as { id?: string; asset_id?: string } | undefined;
      const uploadId = data?.id;
      const assetId = data?.asset_id;
      if (uploadId && assetId) {
        await prisma.lesson.updateMany({
          where: { muxUploadId: uploadId },
          data: { muxAssetId: assetId },
        });
      }
      break;
    }

    case "video.asset.ready": {
      const data = event.data as
        | {
            id?: string;
            duration?: number;
            playback_ids?: Array<{ id: string; policy: string }>;
            upload_id?: string;
          }
        | undefined;
      const assetId = data?.id;
      if (!assetId) break;

      const playbackId = data?.playback_ids?.[0]?.id ?? null;
      const durationSeconds = data?.duration ? Math.round(data.duration) : 0;

      // On peut être ciblé via assetId ou via uploadId (selon l'ordre des events).
      const result = await prisma.lesson.updateMany({
        where: {
          OR: [
            { muxAssetId: assetId },
            data?.upload_id ? { muxUploadId: data.upload_id } : undefined,
          ].filter(Boolean) as Array<{ muxAssetId: string } | { muxUploadId: string }>,
        },
        data: {
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          videoDurationSeconds: durationSeconds,
        },
      });

      // Recalcule la durée totale du cours impacté.
      if (result.count > 0) {
        const lessons = await prisma.lesson.findMany({
          where: { muxAssetId: assetId },
          include: { section: { select: { courseId: true } } },
        });
        const courseIds = new Set(lessons.map((l) => l.section.courseId));
        for (const courseId of courseIds) {
          const total = await prisma.lesson.aggregate({
            where: { section: { courseId }, type: "VIDEO" },
            _sum: { videoDurationSeconds: true },
          });
          await prisma.course.update({
            where: { id: courseId },
            data: { durationSeconds: total._sum.videoDurationSeconds ?? 0 },
          });
        }
      }
      break;
    }

    case "video.asset.errored": {
      const data = event.data as { id?: string } | undefined;
      const assetId = data?.id;
      if (assetId) {
        await prisma.lesson.updateMany({
          where: { muxAssetId: assetId },
          data: {
            muxAssetId: null,
            muxPlaybackId: null,
            muxUploadId: null,
            videoDurationSeconds: 0,
          },
        });
      }
      break;
    }

    default:
      // Évènements non gérés : on les acquitte en succès.
      break;
  }

  return NextResponse.json({ received: true });
}
