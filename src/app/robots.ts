import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://gandal.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/formateur",
          "/formateur/*",
          "/profil",
          "/apprentissage",
          "/apprentissage/*",
          "/panier",
          "/commande/*",
          "/wishlist",
          "/notifications",
          "/api/",
          "/connexion",
          "/inscription",
          "/mot-de-passe-oublie",
          "/reinitialiser-mot-de-passe",
          "/verifier-email",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
