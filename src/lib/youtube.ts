const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  "youtube-nocookie.com", "www.youtube-nocookie.com",
]);

export interface YouTubeVideo { id: string; embedUrl: string }
export const YOUTUBE_ENDED_STATE = 0;

export function isYouTubeEndedState(state: number): boolean { return state === YOUTUBE_ENDED_STATE; }
export function youtubePlayerErrorMessage(code: number): string {
  if (code === 100) return "Cette vidéo YouTube est privée, supprimée ou indisponible.";
  if (code === 101 || code === 150) return "Le propriétaire de cette vidéo interdit sa lecture intégrée.";
  return "YouTube ne peut pas lire cette vidéo. Vérifiez le lien ou réessayez.";
}

export interface YouTubeWatchState { watchedSeconds: number; lastPosition: number | null }
export function observeYouTubePlayback(state: YouTubeWatchState, currentPosition: number, visible = true): YouTubeWatchState {
  if (!visible) return { ...state, lastPosition: null };
  const delta = state.lastPosition === null ? 0 : currentPosition - state.lastPosition;
  return {
    watchedSeconds: state.watchedSeconds + (delta > 0 && delta <= 3 ? delta : 0),
    lastPosition: currentPosition,
  };
}
export function canCompleteYouTube(input: { ended: boolean; watchedSeconds: number; durationSeconds: number; alreadyCompleted: boolean }): boolean {
  return !input.alreadyCompleted && input.ended && input.durationSeconds > 0
    && input.watchedSeconds / input.durationSeconds >= 0.95;
}

export function parseYouTubeUrl(value: string): YouTubeVideo | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = parts.length === 1 ? parts[0] : null;
  else if (url.pathname === "/watch") id = url.searchParams.get("v");
  else if ((parts[0] === "shorts" || parts[0] === "embed") && parts.length === 2) id = parts[1];
  if (!id || !YOUTUBE_ID.test(id)) return null;
  return { id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
}

export function isYouTubeHost(value: string): boolean {
  try { return YOUTUBE_HOSTS.has(new URL(value).hostname.toLowerCase()); }
  catch { return false; }
}

export function normalizeLessonVideoUrl(value: string): { success: true; url: string } | { success: false; message: string } {
  const trimmed = value.trim();
  if (trimmed.startsWith("/uploads/")) return { success: true, url: trimmed };
  let url: URL;
  try { url = new URL(trimmed); } catch { return { success: false, message: "Saisissez une URL vidéo valide." }; }
  if (!/^https?:$/.test(url.protocol)) return { success: false, message: "L’URL doit utiliser HTTP ou HTTPS." };
  if (isYouTubeHost(trimmed)) {
    const youtube = parseYouTubeUrl(trimmed.replace(/^http:/, "https:"));
    return youtube
      ? { success: true, url: youtube.embedUrl }
      : { success: false, message: "Lien YouTube invalide. Utilisez une vidéo watch, youtu.be, Shorts ou embed avec un identifiant valide." };
  }
  return { success: true, url: trimmed };
}
