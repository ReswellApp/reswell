import Link from "next/link"
import type { ReactNode } from "react"

const URL_PATTERN =
  /https?:\/\/[^\s<>"{}|\\^`[\]]+[^\s<>"{}|\\^`[\].,;:!?)]/gi

function isSafeHttpUrl(href: string): boolean {
  try {
    const u = new URL(href)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

type LinkifiedTextProps = {
  text: string
  className?: string
}

/** Renders plain text with http(s) URLs as external links. */
export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const re = new RegExp(URL_PATTERN.source, URL_PATTERN.flags)
  while ((match = re.exec(text)) !== null) {
    const url = match[0]
    const start = match.index
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start))
    }
    if (isSafeHttpUrl(url)) {
      parts.push(
        <Link
          key={`${start}-${url}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2 hover:text-primary/85"
        >
          {url}
        </Link>,
      )
    } else {
      parts.push(url)
    }
    lastIndex = start + url.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  if (parts.length === 0) return null

  return <span className={className}>{parts}</span>
}
