/** First letter, or first+last initials for multi-word names. */
export function brandMarkInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
  if (words.length === 0) return "?"
  const first = words[0]?.[0]
  if (!first) return "?"
  if (words.length === 1) return first.toUpperCase()
  const last = words[words.length - 1]?.[0]
  if (!last) return first.toUpperCase()
  return `${first}${last}`.toUpperCase()
}

/**
 * Deterministic Reswell-palette fill so logo-less brands still get a color
 * profile instead of a generic icon. Hex literals stay complete for Tailwind JIT.
 */
const FALLBACK_TONES = [
  "bg-[#355185] text-white",
  "bg-[#5574AD] text-white",
  "bg-[#7F9DD5] text-[#163060]",
  "bg-[#163060] text-white",
  "bg-[#001A4A] text-[#F9F9F2]",
] as const

export function brandMarkFallbackClassName(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return FALLBACK_TONES[hash % FALLBACK_TONES.length] ?? FALLBACK_TONES[0]
}
