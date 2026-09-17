import type { SupabaseClient } from "@supabase/supabase-js"
import {
  findHelpArticlesBySlugs,
  getHelpCenterPlainTextCorpus,
  type HelpArticlePlainText,
} from "@/lib/help-center/plain-text"
import {
  listAgentRepliesForCases,
  listResolvedCasesForRetrieval,
  listSupportReplyExamples,
} from "@/lib/db/supportReplyDrafts"
import { listSupportMacros, type SupportMacroRow } from "@/lib/db/supportCases"
import {
  rankBySupportReplyScore,
  rankExamplesForQuery,
  rankHelpArticlesForQuery,
  scoreSupportReplyOverlap,
  tokenizeSupportReplyQuery,
} from "@/lib/utils/support-reply-retrieve"
import { CS_AGENT_PROMPT_VERSION } from "@/lib/llm/cs-agent"

export type RetrievedHelpArticle = HelpArticlePlainText & { score: number }
export type RetrievedReplyExample = ReturnType<typeof rankExamplesForQuery>[number]

export const SUPPORT_REPLY_PROMPT_VERSION = CS_AGENT_PROMPT_VERSION

export type SupportReplyKnowledge = {
  helpArticles: RetrievedHelpArticle[]
  examples: RetrievedReplyExample[]
  macros: SupportMacroRow[]
}

export function retrieveHelpArticlesForQuery(query: string, limit = 4): RetrievedHelpArticle[] {
  return rankHelpArticlesForQuery(getHelpCenterPlainTextCorpus(), query, limit) as RetrievedHelpArticle[]
}

export function retrieveExamplesForQuery(
  examples: Parameters<typeof rankExamplesForQuery>[0],
  query: string,
  kind: string | null,
  limit = 4,
): RetrievedReplyExample[] {
  return rankExamplesForQuery(examples, query, kind, limit)
}

export async function gatherSupportReplyKnowledge(
  supabase: SupabaseClient,
  args: {
    query: string
    kind: string | null
    excludeCaseId: string
    /** When set (e.g. live_chat), do not pull other customers' resolved-case admin replies. */
    sourceChannel?: string | null
    requesterUserId?: string | null
    requesterEmail?: string | null
  },
): Promise<SupportReplyKnowledge> {
  const isLiveChat = args.sourceChannel === "live_chat"
  const [examples, macros, resolved] = await Promise.all([
    listSupportReplyExamples(supabase, 100),
    listSupportMacros(supabase),
    isLiveChat
      ? Promise.resolve([])
      : listResolvedCasesForRetrieval(supabase, {
          kind: args.kind ?? undefined,
          excludeId: args.excludeCaseId,
          limit: 60,
        }),
  ])

  // Live chat must not learn from other customers' admin replies — only rated
  // examples, and prefer same-channel when tagged.
  const examplePool = isLiveChat
    ? examples.filter((example) => {
        if (example.rating === "bad") return false
        if (example.source_channel && example.source_channel !== "live_chat") return false
        // Unrated auto-flood (no rated_by) stays out of live-chat retrieval.
        if (!example.rated_by && example.source_channel === "live_chat") return false
        return true
      })
    : examples

  const learned = retrieveExamplesForQuery(examplePool, args.query, args.kind)
  const avoidExamples: RetrievedReplyExample[] = isLiveChat
    ? examples
        .filter(
          (example) =>
            example.rating === "bad" &&
            Boolean(example.rated_by) &&
            Boolean(example.rating_note?.trim()) &&
            (!example.source_channel || example.source_channel === "live_chat"),
        )
        .slice(0, 2)
        .map((example) => ({
          id: example.id,
          kind: example.kind,
          customerExcerpt: example.customer_excerpt,
          staffReply: example.staff_reply,
          rating: example.rating,
          ratingNote: example.rating_note,
          score: 1,
        }))
    : []
  const helpArticles = retrieveHelpArticlesForQuery(args.query)

  // Live chat: always surface Purchase Protection + core seller/buyer help alongside retrieval.
  const liveChatPinned = isLiveChat
    ? findHelpArticlesBySlugs([
        "purchase-protection-claim",
        "seller-returns",
        "package-delayed-or-lost",
      ]).map((article) => ({ ...article, score: 1 }))
    : []
  const helpMerged = [
    ...liveChatPinned,
    ...helpArticles.filter((article) => !liveChatPinned.some((pin) => pin.slug === article.slug)),
  ].slice(0, isLiveChat ? 6 : 4)

  const tokens = tokenizeSupportReplyQuery(args.query)
  const rankedCases = isLiveChat
    ? []
    : rankBySupportReplyScore(
        resolved,
        (row) => {
          const overlap = scoreSupportReplyOverlap(tokens, `${row.subject} ${row.preview}`)
          const kindBoost = args.kind && row.kind === args.kind ? 0.15 : 0
          return overlap + kindBoost
        },
        8,
      )

  const replies =
    rankedCases.length > 0
      ? await listAgentRepliesForCases(
          supabase,
          rankedCases.map((row) => row.id),
        )
      : []
  const replyByCase = new Map<string, string>()
  for (const reply of replies) {
    if (!replyByCase.has(reply.case_id)) replyByCase.set(reply.case_id, reply.body)
  }

  const historical: RetrievedReplyExample[] = rankedCases
    .flatMap((row) => {
      const staffReply = replyByCase.get(row.id)
      if (!staffReply?.trim()) return []
      return [
        {
          id: `case:${row.id}`,
          kind: row.kind,
          customerExcerpt: row.preview || row.subject,
          staffReply: staffReply.trim(),
          rating: "okay" as const,
          ratingNote: null,
          score: scoreSupportReplyOverlap(tokens, `${row.subject} ${row.preview}`),
        },
      ]
    })
    .slice(0, 3)

  const seenReplies = new Set(learned.map((row) => row.staffReply.toLowerCase()))
  const mergedExamples = [
    ...learned,
    ...avoidExamples.filter((row) => !seenReplies.has(row.staffReply.toLowerCase())),
    ...historical.filter((row) => !seenReplies.has(row.staffReply.toLowerCase())),
  ].slice(0, isLiveChat ? 5 : 5)

  const macrosForKind = macros.filter(
    (macro) => !macro.kind_filter || !args.kind || macro.kind_filter === args.kind,
  )

  return {
    helpArticles: helpMerged,
    examples: mergedExamples,
    macros: macrosForKind.slice(0, 4),
  }
}

export function citedHelpFromSlugs(slugs: string[]): HelpArticlePlainText[] {
  return findHelpArticlesBySlugs(slugs)
}
