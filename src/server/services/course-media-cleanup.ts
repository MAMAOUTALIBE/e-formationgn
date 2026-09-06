import "server-only";

import { unlink } from "node:fs/promises";

import { logWarning } from "@/lib/logger";
import { runCourseMediaCleanup } from "@/lib/domain/course-media-cleanup";
import { resolveLocalStoredFilePath } from "@/lib/storage/local";
import { deleteR2Object } from "@/lib/storage/r2";
import {
  deletePrivateObject,
  deletePrivateObjectPrefix,
} from "@/lib/storage/private-object";
import { findPersistedMediaUrlReferences } from "@/server/queries/persistent-media-references";
import { safeDeleteMuxAsset } from "@/server/services/mux-service";
import type { CourseDeletionMedia } from "@/lib/domain/course-deletion";

/** Nettoyage best-effort, uniquement après suppression DB réussie. */
export async function cleanupDeletedCourseMedia(media: CourseDeletionMedia): Promise<void> {
  await runCourseMediaCleanup(media, {
    config: {
      r2AccountId: process.env.R2_ACCOUNT_ID,
      r2Bucket: process.env.R2_BUCKET ?? "e-formationgn",
      r2PublicUrl: process.env.R2_PUBLIC_URL,
    },
    referencedUrls: findPersistedMediaUrlReferences,
    deleteMux: (assetId) => safeDeleteMuxAsset(assetId, { context: { operation: "delete-course" } }),
    deleteLocal: async (key) => {
      const path = resolveLocalStoredFilePath(key.split("/"));
      if (!path) throw new Error("Clé locale invalide.");
      await unlink(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    },
    deleteR2: deleteR2Object,
    deletePrivate: deletePrivateObject,
    deletePrivatePrefix: deletePrivateObjectPrefix,
    warn: (message, context) => logWarning("storage", message, context),
  });
}
