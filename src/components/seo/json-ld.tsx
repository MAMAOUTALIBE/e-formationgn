// Composant utilitaire — sérialise un objet schema.org en JSON-LD inline.
// Le `key` est important pour permettre à React de déduper si plusieurs
// scripts JSON-LD sont injectés sur la même page.

interface JsonLdProps {
  data: object;
  // Identifiant unique pour ce script (sert à React + déduplication SEO).
  id: string;
}

export function JsonLd({ data, id }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      id={id}
      // dangerouslySetInnerHTML est la pratique recommandée pour JSON-LD
      // dans Next.js (cf. https://nextjs.org/docs/app/guides/json-ld).
      // Le contenu vient de notre serveur, jamais de saisie utilisateur.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
