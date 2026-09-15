const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
const UUID_COMPACT_RE = /\b[0-9a-f]{32}\b/gi
const CASE_REF_RE = /\bRS-[A-F0-9]{8}\b/gi
const SUPPORT_PATH_RE =
  /\/(?:admin\/)?support\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/gi
const INBOX_CASE_RE =
  /[?&]case=sc:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/gi

export type SupportInboundCaseHints = {
  caseIds: string[]
  caseRefs: string[]
}

/** Bare address from `Name <user@host>` or a raw email. */
export function extractEmailAddress(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  const angle = trimmed.match(/<([^>]+)>/)
  const value = (angle?.[1] ?? trimmed).trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null
  return value.toLowerCase()
}

/** Drop plus-tags so `jane+tag@gmail.com` matches `jane@gmail.com`. */
export function normalizeEmailForMatch(raw: string | null | undefined): string | null {
  const email = extractEmailAddress(raw)
  if (!email) return null
  const at = email.lastIndexOf("@")
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const baseLocal = local.split("+")[0]
  if (!baseLocal) return null
  return `${baseLocal}@${domain}`
}

export function inboundEmailsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeEmailForMatch(left)
  const b = normalizeEmailForMatch(right)
  return Boolean(a && b && a === b)
}

const UUID_EXACT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_EXACT_RE.test(value)
}

export function compactUuid(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (isUuid(trimmed) && trimmed.length === 36) return trimmed
  if (/^[0-9a-f]{32}$/.test(trimmed)) {
    return `${trimmed.slice(0, 8)}-${trimmed.slice(8, 12)}-${trimmed.slice(12, 16)}-${trimmed.slice(16, 20)}-${trimmed.slice(20)}`
  }
  return null
}

export function extractUuidFromPlusAddress(raw: string | null | undefined): string | null {
  const email = extractEmailAddress(raw)
  if (!email) return null
  const local = email.slice(0, email.lastIndexOf("@"))
  const plus = local.indexOf("+")
  if (plus < 0) return null
  return compactUuid(local.slice(plus + 1))
}

export function formatSupportInboundReplyTo(
  mailbox: string,
  caseId: string,
): string | null {
  const email = extractEmailAddress(mailbox)
  if (!email || !isUuid(caseId)) return null
  const at = email.lastIndexOf("@")
  const local = email.slice(0, at).split("+")[0]
  const domain = email.slice(at + 1)
  if (!local || !domain) return null
  return `${local}+${caseId.toLowerCase()}@${domain}`
}

function pushUnique(list: string[], value: string | null): void {
  if (!value || list.includes(value)) return
  list.push(value)
}

function collectUuids(source: string, into: string[]): void {
  for (const match of source.matchAll(UUID_RE)) {
    pushUnique(into, compactUuid(match[0]))
  }
  for (const match of source.matchAll(SUPPORT_PATH_RE)) {
    pushUnique(into, compactUuid(match[1] ?? ""))
  }
  for (const match of source.matchAll(INBOX_CASE_RE)) {
    pushUnique(into, compactUuid(match[1] ?? ""))
  }
  for (const match of source.matchAll(UUID_COMPACT_RE)) {
    pushUnique(into, compactUuid(match[0]))
  }
}

function collectCaseRefs(source: string, into: string[]): void {
  for (const match of source.matchAll(CASE_REF_RE)) {
    const ref = match[0].toUpperCase()
    if (!into.includes(ref)) into.push(ref)
  }
}

export function collectSupportInboundCaseHints(input: {
  to?: string[]
  subject?: string | null
  text?: string | null
  html?: string | null
}): SupportInboundCaseHints {
  const caseIds: string[] = []
  const caseRefs: string[] = []

  for (const address of input.to ?? []) {
    pushUnique(caseIds, extractUuidFromPlusAddress(address))
  }

  const subject = input.subject ?? ""
  collectUuids(subject, caseIds)
  collectCaseRefs(subject, caseRefs)

  const text = input.text ?? ""
  collectUuids(text, caseIds)
  collectCaseRefs(text, caseRefs)

  if (input.html?.trim()) {
    collectUuids(input.html, caseIds)
    collectCaseRefs(input.html, caseRefs)
  }

  return { caseIds, caseRefs }
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/\r\n/g, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const QUOTE_SPLITTERS = [
  /\nOn .+ wrote:\s*\n/i,
  /\n-+ ?Original Message ?-+\s*\n/i,
  /\nFrom:\s+.+\nSent:\s+/i,
  /\n_{8,}\s*\n/,
  /\nBegin forwarded message:\s*\n/i,
]

/** Keep the new reply; drop Gmail/Outlook quoted history. */
export function stripQuotedReply(text: string): string {
  let body = text.replace(/\r\n/g, "\n").trim()
  if (!body) return ""

  for (const splitter of QUOTE_SPLITTERS) {
    const parts = body.split(splitter)
    if (parts.length > 1 && parts[0]?.trim()) {
      body = parts[0].trim()
      break
    }
  }

  const lines = body.split("\n")
  let cut = lines.length
  for (let i = 0; i < lines.length; i += 1) {
    if (/^>/.test(lines[i] ?? "")) {
      const restQuoted = lines.slice(i).every((line) => !line.trim() || /^>/.test(line))
      if (restQuoted) {
        cut = i
        break
      }
    }
  }

  return lines.slice(0, cut).join("\n").trim()
}

export function inboundEmailPlainBody(input: {
  text?: string | null
  html?: string | null
}): string {
  const text = input.text?.trim() ? stripQuotedReply(input.text) : ""
  if (text) return text
  const fromHtml = input.html?.trim() ? stripQuotedReply(htmlToPlainText(input.html)) : ""
  return fromHtml
}

const AUTO_SUBJECT_RE =
  /^(auto(?:matic|mat)?(?:\s+reply)?|out of office|ooo\b|undeliverable|delivery status notification)\b/i

export function isAutomatedInboundEmail(input: {
  from?: string | null
  subject?: string | null
  headers?: Record<string, string>
}): boolean {
  const headers = lowerHeaderMap(input.headers)
  const autoSubmitted = headers["auto-submitted"]
  if (autoSubmitted && autoSubmitted !== "no") return true
  const precedence = headers.precedence
  if (precedence && /^(bulk|junk|list|auto_reply)$/i.test(precedence)) return true
  if (headers["x-auto-response-suppress"]) return true

  const subject = input.subject?.trim() ?? ""
  if (AUTO_SUBJECT_RE.test(subject)) return true

  const from = extractEmailAddress(input.from) ?? ""
  if (/^(mailer-daemon|postmaster|noreply|no-reply|bounce)@/i.test(from)) return true
  return false
}

function lowerHeaderMap(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value
  }
  return out
}

export function isReswellTransactionalSender(
  from: string | null | undefined,
  inboundMailbox?: string | null,
): boolean {
  const email = extractEmailAddress(from)
  if (!email) return false
  if (inboundMailbox && inboundEmailsMatch(email, inboundMailbox)) return true
  return /^(noreply|no-reply|notifications|mailer-daemon|bounce)@reswell\.app$/i.test(email)
}
