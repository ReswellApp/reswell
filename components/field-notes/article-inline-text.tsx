import Link from "next/link"
import {
  articleHrefForNavigation,
  isReswellInternalHref,
  parseArticleInlineText,
  type ArticleInlineNode,
} from "@/lib/blog/article-inline-text"

const LINK_CLASS_NAME =
  "font-medium text-[#163060] underline underline-offset-4 hover:opacity-80"

function InlineNodes({ nodes }: { nodes: ArticleInlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "text") return <span key={i}>{node.value}</span>
        if (node.type === "strong") {
          return (
            <strong key={i} className="font-semibold text-foreground">
              <InlineNodes nodes={node.children} />
            </strong>
          )
        }

        const href = articleHrefForNavigation(node.href)
        const inner = <InlineNodes nodes={node.children} />
        if (isReswellInternalHref(node.href)) {
          return (
            <Link key={i} href={href} className={LINK_CLASS_NAME}>
              {inner}
            </Link>
          )
        }
        return (
          <a
            key={i}
            href={href}
            className={LINK_CLASS_NAME}
            target="_blank"
            rel="noopener noreferrer"
          >
            {inner}
          </a>
        )
      })}
    </>
  )
}

export function ArticleInlineText({ text }: { text: string }) {
  return <InlineNodes nodes={parseArticleInlineText(text)} />
}
