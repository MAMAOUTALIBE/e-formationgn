import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateReadingMinutes,
  isSafeHref,
  parseInline,
  parseMarkdown,
} from "../../src/lib/markdown";

test("les titres du contenu commencent à h2", () => {
  // Le titre de la leçon occupe déjà h1 : un h1 dans le contenu donnerait au
  // document deux racines et fausserait la navigation au lecteur d'écran.
  const blocks = parseMarkdown("# Introduction\n\n## Détail\n\n##### Trop profond");
  assert.deepEqual(
    blocks.map((b) => (b.type === "heading" ? b.level : b.type)),
    [2, 3, 4],
  );
});

test("listes à puces et numérotées sont regroupées", () => {
  const blocks = parseMarkdown("- un\n- deux\n\n1. a\n2. b");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type === "list" && blocks[0].ordered, false);
  assert.equal(blocks[0].type === "list" && blocks[0].items.length, 2);
  assert.equal(blocks[1].type === "list" && blocks[1].ordered, true);
});

test("un bloc de code n'est pas réinterprété", () => {
  const blocks = parseMarkdown("```js\nconst a = **gras**;\n```");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "code");
  if (blocks[0].type !== "code") return;
  assert.equal(blocks[0].language, "js");
  assert.equal(blocks[0].value, "const a = **gras**;");
});

test("les lignes consécutives forment un seul paragraphe", () => {
  const blocks = parseMarkdown("une ligne\nla suite\n\nautre paragraphe");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type === "paragraph" && blocks[0].children.length, 1);
});

test("gras, italique, code et liens sont reconnus en ligne", () => {
  const nodes = parseInline("Voir **ceci**, `du code` et [le guide](https://exemple.org).");
  const kinds = nodes.map((n) => n.type);
  assert.ok(kinds.includes("strong"));
  assert.ok(kinds.includes("code"));
  assert.ok(kinds.includes("link"));
});

test("une cible de lien dangereuse est refusée et rendue littéralement", () => {
  // `javascript:` survit à l'échappement du HTML puisqu'il vit dans
  // l'attribut : c'est le vecteur classique d'un Markdown de tiers.
  assert.equal(isSafeHref("javascript:alert(1)"), false);
  assert.equal(isSafeHref("data:text/html,<script>"), false);
  assert.equal(isSafeHref("https://exemple.org"), true);
  assert.equal(isSafeHref("/cours/abc"), true);
  assert.equal(isSafeHref("mailto:contact@exemple.org"), true);

  // L'invariant qui compte n'est pas le nombre de nœuds — la parenthèse
  // interne de `alert(1)` coupe le motif en deux morceaux — mais qu'aucun
  // d'eux ne devienne un lien, et que le texte d'origine ressorte entier.
  const nodes = parseInline("[clic](javascript:alert(1))");
  assert.equal(
    nodes.some((node) => node.type === "link"),
    false,
    "aucun nœud de lien ne doit être produit",
  );
  assert.equal(
    nodes.map((node) => (node.type === "text" ? node.value : "")).join(""),
    "[clic](javascript:alert(1))",
  );

  // Cas sans parenthèse interne : un seul morceau, toujours refusé.
  const simple = parseInline("[clic](javascript:alert)");
  assert.equal(simple.length, 1);
  assert.equal(simple[0].type, "text");
});

test("aucun nœud ne peut porter de HTML", () => {
  // La sortie est un arbre typé : même une balise écrite dans la source
  // ressort comme du TEXTE, que React affichera échappé.
  const blocks = parseMarkdown("<img src=x onerror=alert(1)>");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "paragraph");
  if (blocks[0].type !== "paragraph") return;
  assert.deepEqual(blocks[0].children, [
    { type: "text", value: "<img src=x onerror=alert(1)>" },
  ]);
});

test("citations et filets horizontaux", () => {
  const blocks = parseMarkdown("> une citation\n> qui continue\n\n---");
  assert.equal(blocks[0].type, "quote");
  assert.equal(blocks[1].type, "divider");
});

test("la durée de lecture ne descend jamais sous une minute", () => {
  assert.equal(estimateReadingMinutes("trois petits mots"), 1);
  assert.equal(estimateReadingMinutes(Array(400).fill("mot").join(" ")), 2);
});
