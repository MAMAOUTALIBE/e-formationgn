// Télécharge les URLs .mp4 directes de 15 vidéos Pexels via l'API officielle.
//
// Usage :
//   PEXELS_API_KEY=xxx npx tsx scripts/pexels-fetch-videos.ts > pexels-videos.json
//
// Pré-requis : compte gratuit sur https://www.pexels.com/api/ (200 req/h).
//
// Le script ne télécharge PAS les fichiers vidéo eux-mêmes (trop lourd) — il
// produit un JSON avec, pour chaque vidéo : id Pexels, URL .mp4 HD/SD, durée,
// vignette, créateur. Vous pouvez ensuite :
//   - alimenter externalVideoUrl dans le seed (rapide, dépend de pexels.com)
//   - ou téléverser sur Mux via createDirectUpload + curl

import "dotenv/config";

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error("PEXELS_API_KEY manquant. Voir https://www.pexels.com/api/.");
  process.exit(1);
}

interface PexelsVideoFile {
  id: number;
  quality: "hd" | "sd" | "uhd" | "hls" | string;
  file_type: string;
  width: number | null;
  height: number | null;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
  total_results: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Config : 15 requêtes ciblant les catégories de E-FormationGN.
// ─────────────────────────────────────────────────────────────────────────
const QUERIES: Array<{ category: string; q: string }> = [
  // Business / Productivité
  { category: "business", q: "team meeting office" },
  { category: "business", q: "person typing laptop" },
  { category: "business", q: "businessman presentation" },
  { category: "business", q: "video call meeting" },
  { category: "business", q: "business graphs charts" },

  // Tech / Développement
  { category: "tech", q: "programming code screen" },
  { category: "tech", q: "developer working" },
  { category: "tech", q: "cybersecurity matrix" },
  { category: "tech", q: "artificial intelligence neural" },

  // Design
  { category: "design", q: "graphic designer tablet" },
  { category: "design", q: "photographer studio" },
  { category: "design", q: "ui ux design figma" },

  // Marketing
  { category: "marketing", q: "social media smartphone" },
  { category: "marketing", q: "marketing brainstorming team" },

  // Bonus
  { category: "general", q: "online learning student" },
];

interface OutputItem {
  category: string;
  query: string;
  pexelsId: number;
  pageUrl: string;
  durationSeconds: number;
  thumbnail: string;
  author: string;
  authorUrl: string;
  videoFileHd: string | null;
  videoFileSd: string | null;
}

async function searchOne(query: string): Promise<PexelsVideo | null> {
  const url = `https://api.pexels.com/videos/search?per_page=1&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Authorization: API_KEY ?? "" },
  });
  if (!response.ok) {
    console.error(`[pexels] ${query} : HTTP ${response.status}`);
    return null;
  }
  const data = (await response.json()) as PexelsSearchResponse;
  return data.videos[0] ?? null;
}

function bestFile(
  files: PexelsVideoFile[],
  quality: "hd" | "sd",
): string | null {
  return (
    files.find(
      (f) => f.quality === quality && f.file_type.startsWith("video/"),
    )?.link ?? null
  );
}

async function main() {
  const out: OutputItem[] = [];
  for (const { category, q } of QUERIES) {
    const video = await searchOne(q);
    if (!video) continue;
    out.push({
      category,
      query: q,
      pexelsId: video.id,
      pageUrl: video.url,
      durationSeconds: video.duration,
      thumbnail: video.image,
      author: video.user.name,
      authorUrl: video.user.url,
      videoFileHd: bestFile(video.video_files, "hd"),
      videoFileSd: bestFile(video.video_files, "sd"),
    });
    // throttle léger : 200 req/h = ~18 s entre requêtes pour rester safe
    await new Promise((r) => setTimeout(r, 600));
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
