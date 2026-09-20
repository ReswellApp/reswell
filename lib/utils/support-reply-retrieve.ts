const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "so",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "who",
  "with",
  "you",
  "your",
])

export function tokenizeSupportReplyQuery(text: string): string[] {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const raw of text.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
    const token = raw.replace(/'/g, "")
    if (token.length < 3 || STOP_WORDS.has(token) || seen.has(token)) continue
    seen.add(token)
    tokens.push(token)
  }
  return tokens
}

export function scoreSupportReplyOverlap(queryTokens: string[], haystack: string): number {
  if (queryTokens.length === 0) return 0
  const hay = haystack.toLowerCase()
  let hits = 0
  for (const token of queryTokens) {
    if (hay.includes(token)) hits += 1
  }
  return hits / queryTokens.length
}

export function rankBySupportReplyScore<T>(
  items: T[],
  scoreOf: (item: T) => number,
  limit: number,
): T[] {
  return [...items]
    .map((item) => ({ item, score: scoreOf(item) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item)
}

export function rankHelpArticlesForQuery<
  T extends { title: string; keywords: string[]; description: string; body: string },
>(corpus: T[], query: string, limit = 4): Array<T & { score: number }> {
  const tokens = tokenizeSupportReplyQuery(query)
  if (tokens.length === 0) return []

  return corpus
    .map((article) => {
      const titleScore = scoreSupportReplyOverlap(tokens, article.title) * 5
      const keywordScore = scoreSupportReplyOverlap(tokens, article.keywords.join(" ")) * 4
      const descriptionScore = scoreSupportReplyOverlap(tokens, article.description) * 3
      const bodyScore = scoreSupportReplyOverlap(tokens, article.body)
      return {
        ...article,
        score: titleScore + keywordScore + descriptionScore + bodyScore,
      }
    })
    .filter((article) => article.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function rankExamplesForQuery<
  T extends {
    id: string
    kind: string | null
    customer_excerpt: string
    staff_reply: string
    rating: "very_good" | "okay" | "bad"
    rating_note?: string | null
  },
>(
  examples: T[],
  query: string,
  kind: string | null,
  limit = 4,
): Array<{
  id: string
  kind: string | null
  customerExcerpt: string
  staffReply: string
  rating: T["rating"]
  ratingNote: string | null
  score: number
}> {
  const tokens = tokenizeSupportReplyQuery(query)
  return examples
    .filter((example) => example.rating !== "bad")
    .map((example) => {
      const note = example.rating_note?.trim() ?? ""
      const hay = `${example.customer_excerpt} ${example.staff_reply} ${note}`
      const overlap = scoreSupportReplyOverlap(tokens, hay)
      const kindBoost = kind && example.kind === kind ? 0.25 : 0
      const ratingBoost = example.rating === "very_good" ? 0.2 : 0.1
      const noteBoost = note ? 0.05 : 0
      return {
        id: example.id,
        kind: example.kind,
        customerExcerpt: example.customer_excerpt,
        staffReply: example.staff_reply,
        rating: example.rating,
        ratingNote: note || null,
        score: overlap + kindBoost + ratingBoost + noteBoost,
      }
    })
    .filter((example) => example.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export type RankedReplyExample = {
  id: string
  kind: string | null
  customerExcerpt: string
  staffReply: string
  rating: "very_good" | "okay" | "bad"
  ratingNote: string | null
  score: number
}

/** Bad + coach-note examples the live-chat writer must not repeat. */
export function rankAvoidExamplesForQuery<
  T extends {
    id: string
    kind: string | null
    customer_excerpt: string
    staff_reply: string
    rating: "very_good" | "okay" | "bad"
    rating_note?: string | null
  },
>(
  examples: T[],
  query: string,
  kind: string | null,
  limit = 2,
): RankedReplyExample[] {
  const tokens = tokenizeSupportReplyQuery(query)
  return examples
    .filter((example) => example.rating === "bad" && Boolean(example.rating_note?.trim()))
    .map((example) => {
      const note = example.rating_note?.trim() ?? ""
      const hay = `${example.customer_excerpt} ${example.staff_reply} ${note}`
      const overlap = tokens.length === 0 ? 0.25 : scoreSupportReplyOverlap(tokens, hay)
      const kindBoost = kind && example.kind === kind ? 0.25 : 0
      return {
        id: example.id,
        kind: example.kind,
        customerExcerpt: example.customer_excerpt,
        staffReply: example.staff_reply,
        rating: example.rating,
        ratingNote: note || null,
        score: overlap + kindBoost + 0.15,
      }
    })
    .filter((example) => example.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function mergeRatedReplyExamples(
  groups: RankedReplyExample[][],
  limit: number,
): RankedReplyExample[] {
  const seen = new Set<string>()
  const merged: RankedReplyExample[] = []
  for (const group of groups) {
    for (const row of group) {
      const replyKey = row.staffReply.trim().toLowerCase()
      if (!replyKey || seen.has(row.id) || seen.has(replyKey)) continue
      seen.add(row.id)
      seen.add(replyKey)
      merged.push(row)
      if (merged.length >= limit) return merged
    }
  }
  return merged
}

export type SupportConversationMessage = {
  author_role: string
  is_internal?: boolean
  body: string
}

export type SupportConversationTurn = {
  role: "customer" | "staff" | "system"
  body: string
}

const SUBSTANTIAL_LAST_MESSAGE_TOKENS = 3

export function collectCustomerSupportTexts(
  messages: Array<SupportConversationMessage>,
  fallbackSubject: string,
): string[] {
  const bits = messages
    .filter((message) => message.author_role === "customer" && !message.is_internal)
    .map((message) => message.body.trim())
    .filter(Boolean)
  if (bits.length > 0) return bits
  const subject = fallbackSubject.trim()
  return subject ? [subject] : []
}

export function lastCustomerSupportText(
  messages: Array<SupportConversationMessage>,
  fallbackSubject: string,
): string {
  const bits = collectCustomerSupportTexts(messages, fallbackSubject)
  return bits[bits.length - 1] ?? ""
}

export function visibleSupportConversation(
  messages: Array<SupportConversationMessage>,
): SupportConversationTurn[] {
  return messages
    .filter((message) => !message.is_internal)
    .map((message) => {
      const body = message.body.trim()
      const role =
        message.author_role === "agent"
          ? ("staff" as const)
          : message.author_role === "system"
            ? ("system" as const)
            : ("customer" as const)
      return { role, body }
    })
    .filter((turn) => turn.body.length > 0)
}

export function formatSupportConversation(messages: Array<SupportConversationMessage>): string {
  return visibleSupportConversation(messages)
    .map((turn) => `[${turn.role}] ${turn.body}`)
    .join("\n\n")
}

/** Last customer message first; fall back to the thread when that ask is too short to retrieve on. */
export function supportReplyRetrievalQuery(args: {
  lastCustomerMessage: string
  conversation: string
  subject?: string
}): string {
  const last = args.lastCustomerMessage.trim()
  const conversation = args.conversation.trim()
  const subject = args.subject?.trim() ?? ""
  if (last && tokenizeSupportReplyQuery(last).length >= SUBSTANTIAL_LAST_MESSAGE_TOKENS) {
    return last
  }
  return [last, conversation, subject].filter(Boolean).join("\n")
}

export function supportReplyDraftFingerprint(input: {
  promptVersion: string
  caseId: string
  subject: string
  status: string
  lastCustomerMessage: string
  lastMessageAt: string | null
  rootPrompt?: string
}): string {
  const payload = [
    input.promptVersion,
    input.rootPrompt?.trim() ?? "",
    input.caseId,
    input.subject.trim(),
    input.status,
    input.lastCustomerMessage.trim(),
    input.lastMessageAt ?? "",
  ].join("\n")
  return hashFingerprint(payload)
}

function hashFingerprint(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/** Open tickets with no draft, or whose last customer message is newer than the stored draft. */
export function selectOpenCaseIdsNeedingDraft(args: {
  caseIds: string[]
  draftUpdatedAtByCaseId: Map<string, string>
  lastCustomerAtByCaseId: Map<string, string>
  limit: number
}): string[] {
  const needed = args.caseIds.filter((id) => {
    const draftAt = args.draftUpdatedAtByCaseId.get(id)
    if (!draftAt) return true
    const customerAt = args.lastCustomerAtByCaseId.get(id)
    if (!customerAt) return false
    return Date.parse(customerAt) > Date.parse(draftAt)
  })
  return needed.slice(0, Math.max(0, args.limit))
}

export type InboxReplyDraftStatus = "ready" | "writing" | "none"

/** Slack so a draft finished a beat before case.updated_at still counts as ready. */
const REPLY_DRAFT_FRESHNESS_SLACK_MS = 2000

export function inboxReplyDraftStatus(args: {
  isOpen: boolean
  status: string
  caseUpdatedAt: string
  draftUpdatedAt: string | null
  draftHasBody: boolean
}): InboxReplyDraftStatus {
  if (!args.isOpen || args.status === "waiting_on_you") return "none"
  if (args.draftHasBody && args.draftUpdatedAt) {
    const draftAt = Date.parse(args.draftUpdatedAt)
    const caseAt = Date.parse(args.caseUpdatedAt)
    if (Number.isFinite(draftAt) && Number.isFinite(caseAt) && draftAt >= caseAt - REPLY_DRAFT_FRESHNESS_SLACK_MS) {
      return "ready"
    }
  }
  return "writing"
}

/** Same-deployment origin only — never fall back to production from local/preview. */
export function supportReplyDraftWorkerOrigin(env: {
  VERCEL_URL?: string
} = process.env): string | null {
  const vercel = env.VERCEL_URL?.trim()
  if (!vercel) return null
  const host = vercel.replace(/^https?:\/\//, "")
  return host ? `https://${host}` : null
}
