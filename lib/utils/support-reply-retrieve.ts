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
    rating: "accepted" | "edited" | "rejected"
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
  score: number
}> {
  const tokens = tokenizeSupportReplyQuery(query)
  return examples
    .filter((example) => example.rating !== "rejected")
    .map((example) => {
      const hay = `${example.customer_excerpt} ${example.staff_reply}`
      const overlap = scoreSupportReplyOverlap(tokens, hay)
      const kindBoost = kind && example.kind === kind ? 0.25 : 0
      const ratingBoost = example.rating === "accepted" ? 0.2 : 0.1
      return {
        id: example.id,
        kind: example.kind,
        customerExcerpt: example.customer_excerpt,
        staffReply: example.staff_reply,
        rating: example.rating,
        score: overlap + kindBoost + ratingBoost,
      }
    })
    .filter((example) => example.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
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
