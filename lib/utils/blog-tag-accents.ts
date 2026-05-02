export type BlogTagAccent = { pill: string; stripe: string }

/**
 * Visual accents for blog / field-notes tags (index cards + article hero).
 */
export function blogTagAccents(tag: string): BlogTagAccent {
  const key = tag.toLowerCase()
  if (key === "gear") {
    return {
      pill: "border-sky-200/80 bg-sky-50 text-sky-950",
      stripe: "from-sky-500/90 to-cyan-600/80",
    }
  }
  if (key === "culture") {
    return {
      pill: "border-violet-200/80 bg-violet-50 text-violet-950",
      stripe: "from-violet-500/85 to-fuchsia-600/75",
    }
  }
  if (key === "travel") {
    return {
      pill: "border-amber-200/80 bg-amber-50 text-amber-950",
      stripe: "from-amber-500/85 to-orange-600/75",
    }
  }
  return {
    pill: "border-border bg-muted/80 text-foreground",
    stripe: "from-foreground/30 to-foreground/15",
  }
}
