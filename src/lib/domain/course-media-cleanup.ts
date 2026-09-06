import type { CourseDeletionMedia } from "@/lib/domain/course-deletion";
import { managedCourseObjectFromUrl, type CourseStorageConfig } from "@/lib/storage/course-media-provenance";

export interface CourseMediaCleanupDependencies {
  config: CourseStorageConfig;
  referencedUrls: (urls: string[]) => Promise<Set<string>>;
  deleteMux: (assetId: string) => Promise<boolean>;
  deleteLocal: (key: string) => Promise<void>;
  deleteR2: (key: string) => Promise<void>;
  deletePrivate: (key: string) => Promise<void>;
  deletePrivatePrefix: (prefix: string) => Promise<void>;
  warn: (message: string, context: Record<string, unknown>) => void;
}

export async function runCourseMediaCleanup(media: CourseDeletionMedia, deps: CourseMediaCleanupDependencies): Promise<void> {
  for (const assetId of new Set(media.muxAssetIds)) {
    try {
      if (!(await deps.deleteMux(assetId))) deps.warn("Asset Mux non supprimé", { assetId });
    } catch (error) {
      deps.warn("Asset Mux non supprimé", { assetId, error: String(error) });
    }
  }
  for (const key of new Set(media.privateKeys ?? [])) {
    try {
      await deps.deletePrivate(key);
    } catch (error) {
      deps.warn("Objet pédagogique privé non supprimé", { key, error: String(error) });
    }
  }
  for (const prefix of new Set(media.privatePrefixes ?? [])) {
    try {
      await deps.deletePrivatePrefix(prefix);
    } catch (error) {
      deps.warn("Artefacts pédagogiques privés non supprimés", {
        prefix,
        error: String(error),
      });
    }
  }
  const storedUrls = [...new Set(media.storedUrls)];
  let referenced: Set<string>;
  try {
    referenced = await deps.referencedUrls(storedUrls);
  } catch (error) {
    deps.warn("Médias conservés : vérification des références impossible", { error: String(error) });
    return;
  }
  for (const url of storedUrls) {
    try {
      if (referenced.has(url)) continue;
      const object = managedCourseObjectFromUrl(url, media.ownerId, deps.config);
      if (!object) {
        deps.warn("Média conservé : provenance ou propriétaire non vérifiable", { url });
        continue;
      }
      if (object.backend === "local") await deps.deleteLocal(object.key);
      else await deps.deleteR2(object.key);
    } catch (error) {
      deps.warn("Nettoyage de média de formation échoué", { url, error: String(error) });
    }
  }
}
