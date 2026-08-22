// Rendu d'un sous-ensemble de Markdown vers un ARBRE DE NŒUDS, jamais vers du
// HTML.
//
// L'éditeur de leçon annonce « Markdown supporté » depuis toujours, mais le
// lecteur affichait le texte brut : les dièses et les astérisques arrivaient
// tels quels sous les yeux de l'élève. Ce module comble l'écart.
//
// Pourquoi analyser nous-mêmes plutôt qu'ajouter une bibliothèque : le contenu
// vient d'un formateur, donc d'un tiers, et toutes les passerelles Markdown
// usuelles finissent par produire une chaîne de HTML qu'il faut injecter avec
// `dangerouslySetInnerHTML`. En sortant des nœuds typés que React rend comme
// du texte, l'injection de balises devient structurellement impossible — il
// n'y a aucun endroit où du HTML pourrait entrer. C'est aussi ce qui rend le
// module testable sans navigateur.
//
// Sous-ensemble couvert : titres, paragraphes, listes à puces et numérotées,
// citations, blocs de code, filets horizontaux ; en ligne : gras, italique,
// code, liens. Tout le reste est rendu littéralement, ce qui est le
// comportement le moins surprenant : un caractère non reconnu s'affiche.

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: InlineNode[] };

export type BlockNode =
  | { type: "heading"; level: 2 | 3 | 4; children: InlineNode[] }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "quote"; children: InlineNode[] }
  | { type: "code"; language: string | null; value: string }
  | { type: "divider" };

/**
 * Seuls `http`, `https` et `mailto` sont acceptés.
 *
 * `javascript:` dans un lien Markdown est le vecteur d'injection classique, et
 * il survit à l'échappement du HTML puisqu'il vit dans l'attribut. Une cible
 * non reconnue fait retomber le lien en texte simple : on n'affiche jamais un
 * lien dont on ne sait pas où il mène.
 */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value.startsWith("/") || value.startsWith("#")) return true;
  return /^(https?:|mailto:)/i.test(value);
}

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]*\]\([^)\s]+\))/;

/** Analyse le contenu en ligne d'une ligne (gras, italique, code, liens). */
export function parseInline(input: string): InlineNode[] {
  if (input.length === 0) return [];

  const parts = input.split(INLINE_PATTERN).filter((part) => part.length > 0);
  const nodes: InlineNode[] = [];

  for (const part of parts) {
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length > 4)
    ) {
      nodes.push({ type: "strong", children: parseInline(part.slice(2, -2)) });
      continue;
    }
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length > 2)
    ) {
      nodes.push({ type: "em", children: parseInline(part.slice(1, -1)) });
      continue;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      nodes.push({ type: "code", value: part.slice(1, -1) });
      continue;
    }
    const link = /^\[([^\]]*)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      if (isSafeHref(href)) {
        nodes.push({
          type: "link",
          href: href.trim(),
          children: parseInline(label) ,
        });
      } else {
        // Cible refusée : on restitue la syntaxe littérale plutôt que de
        // fabriquer un lien muet, pour que l'élève voie ce qui était écrit.
        nodes.push({ type: "text", value: part });
      }
      continue;
    }
    nodes.push({ type: "text", value: part });
  }

  return nodes;
}

/** Découpe un texte Markdown en blocs. */
export function parseMarkdown(source: string): BlockNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: BlockNode[] = [];

  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushParagraph();
      continue;
    }

    // Bloc de code : on avale tel quel jusqu'à la clôture, sans analyse en
    // ligne — c'est tout l'intérêt d'un bloc de code.
    if (trimmed.startsWith("```")) {
      flushParagraph();
      const language = trimmed.slice(3).trim() || null;
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", language, value: body.join("\n") });
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      // Le titre de la leçon occupe déjà le niveau 1 de la page : les titres
      // du contenu commencent donc à h2, sans quoi le document aurait deux
      // racines et la navigation par lecteur d'écran s'en trouverait faussée.
      const level = Math.min(4, heading[1].length + 1) as 2 | 3 | 4;
      blocks.push({ type: "heading", level, children: parseInline(heading[2]) });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      const body: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("> ")) {
        body.push(lines[index].trim().slice(2));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "quote", children: parseInline(body.join(" ")) });
      continue;
    }

    const bulletMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
    const orderedMatch = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bulletMatch || orderedMatch) {
      flushParagraph();
      const ordered = Boolean(orderedMatch);
      const items: InlineNode[][] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const bullet = /^[-*+]\s+(.*)$/.exec(current);
        const numbered = /^\d+[.)]\s+(.*)$/.exec(current);
        const match = ordered ? numbered : bullet;
        if (!match) break;
        items.push(parseInline(match[1]));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

/**
 * Nombre de mots du contenu, pour estimer la durée de lecture.
 * 200 mots/minute : moyenne basse retenue volontairement — annoncer une durée
 * trop courte décourage plus qu'une durée honnête.
 */
export function estimateReadingMinutes(source: string): number {
  const words = source.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
