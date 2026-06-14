import { defaultsToEffectivePageSeo, type EffectivePageSeo, type ManagedPageSeoItem } from "@/lib/seo/types"

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

export function gradeForScore(score: number): SeoScoreResult["grade"] {
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

  return { score, grade: gradeForScore(score), issues }
}

export interface SeoHealthSummary {
  /** Mean of every managed page's score, 0–100. */
  score: number
  grade: SeoScoreResult["grade"]
  pageCount: number
  /** Pages scoring below 75 (grade C or D). */
  needsAttention: number
  missingDescription: number
  missingShareImage: number
  noindex: number
  /** Up to a handful of the lowest-scoring pages, worst first. */
  weakestPages: { key: string; label: string; score: number }[]
  /** Pages sharing an identical title or description (cannibalization risk). */
  duplicateGroups: DuplicateGroup[]
  /** Total pages involved in any duplicate group. */
  duplicatePageCount: number
}

export interface DuplicateGroup {
  field: "title" | "description"
  value: string
  pages: { key: string; label: string }[]
}

/** Group indexable pages that share a normalized title or description. */
function findDuplicates(
  rows: { key: string; label: string; title: string; description: string; indexable: boolean }[],
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  for (const field of ["title", "description"] as const) {
    const byValue = new Map<string, { display: string; pages: { key: string; label: string }[] }>()
    for (const row of rows) {
      if (!row.indexable) continue
      const raw = row[field].trim()
      if (!raw) continue
      const norm = raw.toLowerCase().replace(/\s+/g, " ")
      const entry = byValue.get(norm) ?? { display: raw, pages: [] }
      entry.pages.push({ key: row.key, label: row.label })
      byValue.set(norm, entry)
    }
    for (const entry of byValue.values()) {
      if (entry.pages.length > 1) {
        groups.push({ field, value: entry.display, pages: entry.pages })
      }
    }
  }
  return groups
}

/**
 * Roll every managed page's effective SEO into one site-wide health summary.
 * Pure: callers pass managed page items (code defaults from lib/seo/managed-pages.ts).
 */
export function summarizeSeoHealth(items: ManagedPageSeoItem[]): SeoHealthSummary {
  if (items.length === 0) {
    return {
      score: 0,
      grade: "D",
      pageCount: 0,
      needsAttention: 0,
      missingDescription: 0,
      missingShareImage: 0,
      noindex: 0,
      weakestPages: [],
      duplicateGroups: [],
      duplicatePageCount: 0,
    }
  }

  // Dynamic page-type templates aren't individual pages — exclude from the site average.
  const pages = items.filter((it) => it.kind !== "dynamic")
  if (pages.length === 0) {
    return {
      score: 0,
      grade: "D",
      pageCount: 0,
      needsAttention: 0,
      missingDescription: 0,
      missingShareImage: 0,
      noindex: 0,
      weakestPages: [],
      duplicateGroups: [],
      duplicatePageCount: 0,
    }
  }

  let total = 0
  let needsAttention = 0
  let missingDescription = 0
  let missingShareImage = 0
  let noindex = 0
  const scored: { key: string; label: string; score: number }[] = []
  const dupRows: { key: string; label: string; title: string; description: string; indexable: boolean }[] = []

  for (const item of pages) {
    const eff = defaultsToEffectivePageSeo(item.defaults)
    const { score } = scorePageSeo(eff)
    total += score
    scored.push({ key: item.key, label: item.label, score })
    if (score < 75) needsAttention += 1
    if (!eff.description.trim()) missingDescription += 1
    if (!eff.ogImageUrl) missingShareImage += 1
    if (!eff.robotsIndex) noindex += 1
    dupRows.push({
      key: item.key,
      label: item.label,
      title: eff.title,
      description: eff.description,
      indexable: eff.robotsIndex,
    })
  }

  const duplicateGroups = findDuplicates(dupRows)
  const duplicatePageCount = new Set(
    duplicateGroups.flatMap((g) => g.pages.map((p) => p.key)),
  ).size

  const score = Math.round(total / pages.length)
  const weakestPages = scored
    .filter((p) => p.score < 90)
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)

  return {
    score,
    grade: gradeForScore(score),
    pageCount: pages.length,
    needsAttention,
    missingDescription,
    missingShareImage,
    noindex,
    weakestPages,
    duplicateGroups,
    duplicatePageCount,
  }
}
