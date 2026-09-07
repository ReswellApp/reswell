export type ArticleInlineNode =
  | { type: "text"; value: string }
  | { type: "link"; href: string; children: ArticleInlineNode[] }
  | { type: "strong"; children: ArticleInlineNode[] }

const RESWELL_HOST = "reswell.app"

/** Allow http(s) URLs and same-origin paths. Reject javascript/data/protocol-relative. */
export function sanitizeArticleHref(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    if (trimmed.includes("://") || /[\s<>]/.test(trimmed)) return null
    return trimmed
  }
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.href
  } catch {
    return null
  }
}

export function isReswellInternalHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true
  try {
    const host = new URL(href).hostname.toLowerCase().replace(/^www\./, "")
    return host === RESWELL_HOST
  } catch {
    return false
  }
}

/** Next.js `Link` href for Reswell URLs; otherwise the sanitized absolute URL. */
export function articleHrefForNavigation(href: string): string {
  if (href.startsWith("/") && !href.startsWith("//")) return href
  try {
    const url = new URL(href)
    if (url.hostname.toLowerCase().replace(/^www\./, "") === RESWELL_HOST) {
      return `${url.pathname}${url.search}${url.hash}` || "/"
    }
  } catch {
    return href
  }
  return href
}

type TokenMatch = {
  index: number
  length: number
  node: ArticleInlineNode
}

function unescapeHtmlText(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function firstMatch(text: string, regex: RegExp): RegExpExecArray | null {
  regex.lastIndex = 0
  return regex.exec(text)
}

function nextToken(text: string): TokenMatch | null {
  const candidates: TokenMatch[] = []

  const mdLink = firstMatch(text, /\[([^\]]+)\]\(([^)\s]+)\)/)
  if (mdLink && mdLink.index !== undefined) {
    const href = sanitizeArticleHref(mdLink[2] ?? "")
    const label = mdLink[1] ?? ""
    if (href) {
      candidates.push({
        index: mdLink.index,
        length: mdLink[0].length,
        node: { type: "link", href, children: parseArticleInlineText(label) },
      })
    }
  }

  const htmlLink = firstMatch(text, /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
  if (htmlLink && htmlLink.index !== undefined) {
    const href = sanitizeArticleHref(htmlLink[1] ?? "")
    const inner = htmlLink[2] ?? ""
    if (href) {
      candidates.push({
        index: htmlLink.index,
        length: htmlLink[0].length,
        node: { type: "link", href, children: parseArticleInlineText(inner) },
      })
    }
  }

  const mdBold = firstMatch(text, /\*\*([^*]+)\*\*/)
  if (mdBold && mdBold.index !== undefined) {
    candidates.push({
      index: mdBold.index,
      length: mdBold[0].length,
      node: { type: "strong", children: parseArticleInlineText(mdBold[1] ?? "") },
    })
  }

  const htmlBold = firstMatch(text, /<(strong|b)>([\s\S]*?)<\/\1>/i)
  if (htmlBold && htmlBold.index !== undefined) {
    candidates.push({
      index: htmlBold.index,
      length: htmlBold[0].length,
      node: { type: "strong", children: parseArticleInlineText(htmlBold[2] ?? "") },
    })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.index - b.index || b.length - a.length)
  return candidates[0] ?? null
}

/** Parse markdown (`[label](url)`, `**bold**`) and simple HTML (`<a>`, `<strong>`). */
export function parseArticleInlineText(text: string): ArticleInlineNode[] {
  if (!text) return []

  const nodes: ArticleInlineNode[] = []
  let remaining = text

  while (remaining.length > 0) {
    const token = nextToken(remaining)
    if (!token) {
      nodes.push({ type: "text", value: unescapeHtmlText(remaining) })
      break
    }
    if (token.index > 0) {
      nodes.push({ type: "text", value: unescapeHtmlText(remaining.slice(0, token.index)) })
    }
    nodes.push(token.node)
    remaining = remaining.slice(token.index + token.length)
  }

  return nodes
}
