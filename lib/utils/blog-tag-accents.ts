export type BlogTagAccent = {
  pill: string
  stripe: string
  /** Hex stops for generated title-card / OG art (Satori cannot use Tailwind). */
  ogFrom: string
  ogTo: string
}

/**
 * Visual accents for blog / field-notes tags (index cards + article hero).
 */
export function blogTagAccents(tag: string): BlogTagAccent {
  const key = tag.toLowerCase()
  if (key === "gear") {
    return {
      pill: "border-sky-200/80 bg-sky-50 text-sky-950",
      stripe: "from-sky-500/90 to-cyan-600/80",
      ogFrom: "#0ea5e9",
      ogTo: "#0891b2",
    }
  }
  if (key === "culture") {
    return {
      pill: "border-violet-200/80 bg-violet-50 text-violet-950",
      stripe: "from-violet-500/85 to-fuchsia-600/75",
      ogFrom: "#8b5cf6",
      ogTo: "#c026d3",
    }
  }
  if (key === "travel") {
    return {
      pill: "border-amber-200/80 bg-amber-50 text-amber-950",
      stripe: "from-amber-500/85 to-orange-600/75",
      ogFrom: "#f59e0b",
      ogTo: "#ea580c",
    }
  }
  return {
    pill: "border-border bg-muted/80 text-foreground",
    stripe: "from-foreground/30 to-foreground/15",
    ogFrom: "#94a3b8",
    ogTo: "#64748b",
  }
}
