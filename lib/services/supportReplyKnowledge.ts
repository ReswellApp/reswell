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

<<<<<<< HEAD
export const SUPPORT_REPLY_PROMPT_VERSION = "support-reply-draft-v2"
=======
export const SUPPORT_REPLY_PROMPT_VERSION = CS_AGENT_PROMPT_VERSION
>>>>>>> ec0327c5cd55e6cddb43092aa1c302943de40493

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
  args: { query: string; kind: string | null; excludeCaseId: string },
): Promise<SupportReplyKnowledge> {
  const [examples, macros, resolved] = await Promise.all([
    listSupportReplyExamples(supabase, 100),
    listSupportMacros(supabase),
    listResolvedCasesForRetrieval(supabase, {
      kind: args.kind ?? undefined,
      excludeId: args.excludeCaseId,
      limit: 60,
    }),
  ])

  const learned = retrieveExamplesForQuery(examples, args.query, args.kind)
  const helpArticles = retrieveHelpArticlesForQuery(args.query)

  const tokens = tokenizeSupportReplyQuery(args.query)
  const rankedCases = rankBySupportReplyScore(
    resolved,
    (row) => {
      const overlap = scoreSupportReplyOverlap(tokens, `${row.subject} ${row.preview}`)
      const kindBoost = args.kind && row.kind === args.kind ? 0.15 : 0
      return overlap + kindBoost
    },
    8,
  )

  const replies = await listAgentRepliesForCases(
    supabase,
    rankedCases.map((row) => row.id),
  )
  const replyByCase = new Map<string, string>()
  for (const reply of replies) {
    if (!replyByCase.has(reply.case_id)) replyByCase.set(reply.case_id, reply.body)
  }

  const historical: RetrievedReplyExample[] = rankedCases.flatMap((row) => {
    const staffReply = replyByCase.get(row.id)
    if (!staffReply?.trim()) return []
    return [
      {
        id: `case:${row.id}`,
        kind: row.kind,
        customerExcerpt: row.preview || row.subject,
        staffReply: staffReply.trim(),
        rating: "accepted" as const,
        score: scoreSupportReplyOverlap(tokens, `${row.subject} ${row.preview}`),
      },
    ]
  }).slice(0, 3)

  const seenReplies = new Set(learned.map((row) => row.staffReply.toLowerCase()))
  const mergedExamples = [
    ...learned,
    ...historical.filter((row) => !seenReplies.has(row.staffReply.toLowerCase())),
  ].slice(0, 5)

  const macrosForKind = macros.filter(
    (macro) => !macro.kind_filter || !args.kind || macro.kind_filter === args.kind,
  )

  return {
    helpArticles,
    examples: mergedExamples,
    macros: macrosForKind.slice(0, 4),
  }
}

export function citedHelpFromSlugs(slugs: string[]): HelpArticlePlainText[] {
  return findHelpArticlesBySlugs(slugs)
}
