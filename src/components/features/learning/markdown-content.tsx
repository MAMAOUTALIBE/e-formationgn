// Rend l'arbre produit par `@/lib/markdown` en éléments React.
//
// Aucun `dangerouslySetInnerHTML` : chaque nœud devient un élément typé, et le
// texte reste du texte. Une balise écrite par un formateur s'affiche donc
// telle quelle au lieu de s'exécuter.

import type { BlockNode, InlineNode } from "@/lib/markdown";
import { parseMarkdown } from "@/lib/markdown";

function renderInline(nodes: InlineNode[], keyPrefix: string): React.ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "strong":
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
          >
            {node.value}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[color:var(--brand-secondary)] underline underline-offset-2"
          >
            {renderInline(node.children, key)}
          </a>
        );
      default:
        return <span key={key}>{node.value}</span>;
    }
  });
}

function renderBlock(block: BlockNode, key: string): React.ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as "h2" | "h3" | "h4";
      const size =
        block.level === 2
          ? "text-xl sm:text-2xl"
          : block.level === 3
            ? "text-lg sm:text-xl"
            : "text-base sm:text-lg";
      return (
        <Tag
          key={key}
          className={`mt-8 scroll-mt-20 font-semibold tracking-tight text-foreground first:mt-0 ${size}`}
        >
          {renderInline(block.children, key)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="text-[1.0625rem] leading-[1.75] text-foreground">
          {renderInline(block.children, key)}
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          key={key}
          className={`space-y-2 pl-6 text-[1.0625rem] leading-[1.75] text-foreground ${
            block.ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {block.items.map((item, index) => (
            <li key={`${key}-${index}`} className="pl-1">
              {renderInline(item, `${key}-${index}`)}
            </li>
          ))}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-2 border-[color:var(--brand-secondary)] pl-4 text-[1.0625rem] italic leading-[1.75] text-muted-foreground"
        >
          {renderInline(block.children, key)}
        </blockquote>
      );
    case "code":
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-lg border border-border bg-muted/60 p-4 text-sm"
        >
          <code className="font-mono text-foreground">{block.value}</code>
        </pre>
      );
    default:
      return <hr key={key} className="border-border" />;
  }
}

export function MarkdownContent({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => renderBlock(block, `b${index}`))}
    </div>
  );
}
