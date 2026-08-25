export interface YouTubeReadyScope {
  onYouTubeIframeAPIReady?: () => void;
}

/** Installe un callback chaîné et retourne une restauration non destructive. */
export function installYouTubeReadyCallback(
  scope: YouTubeReadyScope,
  onReady: () => void,
): () => void {
  const previous = scope.onYouTubeIframeAPIReady;
  const ready = () => {
    try { previous?.(); } finally { onReady(); }
  };
  scope.onYouTubeIframeAPIReady = ready;
  return () => {
    if (scope.onYouTubeIframeAPIReady === ready) scope.onYouTubeIframeAPIReady = previous;
  };
}
