import type { SupabaseClient } from "@supabase/supabase-js"
import { deleteMarketplaceMessageAsAdmin } from "@/lib/db/adminMarketplaceMessages"
import {
  messageAppearsToBePhishing,
  PHISHING_MESSAGE_SQL_PREFILTER_PATTERNS,
} from "@/lib/utils/detect-message-phishing"

export type PhishingMarketplaceMessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export type PurgePhishingMarketplaceMessagesResult = {
  candidatesScanned: number
  matched: number
  deleted: number
  failed: number
  deletedMessageIds: string[]
  affectedConversationIds: string[]
  errors: string[]
}

const CANDIDATE_SELECT = "id, conversation_id, sender_id, content, created_at"

async function fetchPhishingMessageCandidates(
  supabase: SupabaseClient,
): Promise<PhishingMarketplaceMessageRow[]> {
  const byId = new Map<string, PhishingMarketplaceMessageRow>()

  for (const pattern of PHISHING_MESSAGE_SQL_PREFILTER_PATTERNS) {
    const { data, error } = await supabase
      .from("messages")
      .select(CANDIDATE_SELECT)
      .ilike("content", pattern)
      .limit(500)

    if (error) {
      throw new Error(`Failed to load phishing message candidates (${pattern}): ${error.message}`)
    }

    for (const row of data ?? []) {
      if (!row.id || !row.conversation_id || typeof row.content !== "string") continue
      byId.set(row.id, row as PhishingMarketplaceMessageRow)
    }
  }

  return Array.from(byId.values())
}

export async function listPhishingMarketplaceMessages(
  supabase: SupabaseClient,
): Promise<PhishingMarketplaceMessageRow[]> {
  const candidates = await fetchPhishingMessageCandidates(supabase)
  return candidates.filter((row) => messageAppearsToBePhishing(row.content))
}

export async function purgePhishingMarketplaceMessages(
  supabase: SupabaseClient,
): Promise<PurgePhishingMarketplaceMessagesResult> {
  const candidates = await fetchPhishingMessageCandidates(supabase)
  const matchedRows = candidates.filter((row) => messageAppearsToBePhishing(row.content))

  const result: PurgePhishingMarketplaceMessagesResult = {
    candidatesScanned: candidates.length,
    matched: matchedRows.length,
    deleted: 0,
    failed: 0,
    deletedMessageIds: [],
    affectedConversationIds: [],
    errors: [],
  }

  const affectedConversationIds = new Set<string>()

  for (const row of matchedRows) {
    const deleteResult = await deleteMarketplaceMessageAsAdmin(supabase, row.id)
    if (deleteResult.ok) {
      result.deleted += 1
      result.deletedMessageIds.push(row.id)
      affectedConversationIds.add(deleteResult.conversationId)
      continue
    }

    result.failed += 1
    if (deleteResult.kind === "db_error") {
      result.errors.push(`${row.id}: ${deleteResult.error.message}`)
    } else {
      result.errors.push(`${row.id}: not found`)
    }
  }

  result.affectedConversationIds = Array.from(affectedConversationIds)
  return result
}
