import type { EffectivePageSeo } from "@/lib/seo/types"

/** Recommended character ranges for search snippets (Google truncates near the upper bound). */
export const SEO_LIMITS = {
  title: { min: 30, max: 60, hardMax: 70 },
  description: { min: 70, max: 160, hardMax: 200 },
  ogTitle: { min: 20, max: 70, hardMax: 90 },
  ogDescription: { min: 60, max: 200, hardMax: 300 },
} as const

export type CounterTone = "good" | "warn" | "over"

/** Tone for a character counter given a value length and a limit band. */
export function counterTone(
  length: number,
  band: { min: number; max: number; hardMax: number },
): CounterTone {
  if (length === 0) return "warn"
  if (length > band.hardMax) return "over"
  if (length < band.min || length > band.max) return "warn"
  return "good"
}

export type SeoIssueLevel = "good" | "warn" | "error"

export interface SeoIssue {
  level: SeoIssueLevel
  message: string
}

export interface SeoScoreResult {
  score: number
  grade: "A" | "B" | "C" | "D"
  issues: SeoIssue[]
}

function grade(score: number): SeoScoreResult["grade"] {
  if (score >= 90) return "A"
  if (score >= 75) return "B"
  if (score >= 55) return "C"
  return "D"
}

/**
 * Heuristic SEO health for a page's effective (merged) metadata. Returns a 0–100 score and
 * an ordered list of issues to surface in the panel.
 */
export function scorePageSeo(eff: EffectivePageSeo): SeoScoreResult {
  const issues: SeoIssue[] = []
  let score = 100

  const titleLen = eff.title.trim().length
  if (titleLen === 0) {
    score -= 35
    issues.push({ level: "error", message: "Title is empty." })
  } else if (titleLen < SEO_LIMITS.title.min) {
    score -= 12
    issues.push({ level: "warn", message: `Title is short (${titleLen} chars) — aim for ${SEO_LIMITS.title.min}–${SEO_LIMITS.title.max}.` })
  } else if (titleLen > SEO_LIMITS.title.hardMax) {
    score -= 14
    issues.push({ level: "warn", message: `Title may be truncated in search (${titleLen} chars).` })
  } else {
    issues.push({ level: "good", message: "Title length is in the ideal range." })
  }

  const descLen = eff.description.trim().length
  if (descLen === 0) {
    score -= 25
    issues.push({ level: "error", message: "Meta description is empty." })
  } else if (descLen < SEO_LIMITS.description.min) {
    score -= 10
    issues.push({ level: "warn", message: `Description is short (${descLen} chars) — aim for ${SEO_LIMITS.description.min}–${SEO_LIMITS.description.max}.` })
  } else if (descLen > SEO_LIMITS.description.hardMax) {
    score -= 12
    issues.push({ level: "warn", message: `Description may be truncated in search (${descLen} chars).` })
  } else {
    issues.push({ level: "good", message: "Description length is in the ideal range." })
  }

  if (!eff.canonical.trim()) {
    score -= 10
    issues.push({ level: "warn", message: "No canonical URL set." })
  }

  if (!eff.ogImageUrl) {
    score -= 8
    issues.push({ level: "warn", message: "No social share image — link previews will fall back to the site default." })
  } else {
    issues.push({ level: "good", message: "Social share image is set." })
  }

  if (!eff.robotsIndex) {
    score -= 20
    issues.push({ level: "error", message: "Page is set to noindex — it will not appear in search." })
  }

  score = Math.max(0, Math.min(100, score))

  // Surface errors first, then warnings, then positives.
  const order: Record<SeoIssueLevel, number> = { error: 0, warn: 1, good: 2 }
  issues.sort((a, b) => order[a.level] - order[b.level])

  return { score, grade: grade(score), issues }
}
