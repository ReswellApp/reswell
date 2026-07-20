import { createHash } from "node:crypto"

/** Normalize noisy stack frames so redeploys with different line offsets still group. */
export function normalizeStackSample(stack: string | null | undefined): string {
  if (!stack) return ""
  return stack
    .split("\n")
    .slice(0, 8)
    .map((line) =>
      line
        .trim()
        .replace(/https?:\/\/[^/\s]+/g, "")
        .replace(/:\d+:\d+/g, "")
        .replace(/\?.*$/, "")
        .replace(/\s+/g, " "),
    )
    .filter(Boolean)
    .join("\n")
}

export function opsFingerprint(parts: Array<string | null | undefined>): string {
  const normalized = parts
    .map((part) => (part ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 400))
    .join("|")
  return createHash("sha256").update(normalized).digest("hex")
}

export function opsReferenceCode(fingerprint: string): string {
  return `ERR-${fingerprint.slice(0, 6).toUpperCase()}`
}

export function truncateOpsText(value: string | null | undefined, max = 2000): string {
  if (!value) return ""
  return value.length > max ? `${value.slice(0, max)}…` : value
}
