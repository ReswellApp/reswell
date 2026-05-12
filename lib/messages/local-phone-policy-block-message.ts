import { z } from "zod"

export const LOCAL_PHONE_POLICY_BLOCK_ID_PREFIX = "local-phone-block-" as const

export const localPhonePolicyBlockMetadataSchema = z.object({
  kind: z.literal("local_phone_policy_block"),
  originalContent: z.string(),
})

export type LocalPhonePolicyBlockMetadata = z.infer<typeof localPhonePolicyBlockMetadataSchema>

export function parseLocalPhonePolicyBlockMetadata(
  metadata: unknown,
): LocalPhonePolicyBlockMetadata | null {
  const parsed = localPhonePolicyBlockMetadataSchema.safeParse(metadata)
  return parsed.success ? parsed.data : null
}

/**
 * Keeps client-only policy reminders when the thread is re-fetched from Supabase.
 */
export function mergeServerMessagesPreservingLocalPhoneBlocks<
  T extends { id: string; created_at: string; metadata?: unknown | null },
>(previous: T[], serverRows: T[]): T[] {
  const localOnly = previous.filter((m) => parseLocalPhonePolicyBlockMetadata(m.metadata) != null)
  const seen = new Set(serverRows.map((m) => m.id))
  const merged = [...serverRows] as T[]
  for (const m of localOnly) {
    if (!seen.has(m.id)) {
      seen.add(m.id)
      merged.push(m)
    }
  }
  merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return merged
}

/**
 * Synthetic row — never persisted. Shown only in the sender’s client state (admin still has fraud_messages).
 */
export function createLocalPhonePolicyBlockMessage(params: {
  senderId: string
  originalContent: string
  id?: string
}): {
  id: string
  content: string
  sender_id: string
  is_read: boolean
  created_at: string
  metadata: LocalPhonePolicyBlockMetadata
} {
  return {
    id: params.id ?? `${LOCAL_PHONE_POLICY_BLOCK_ID_PREFIX}${crypto.randomUUID()}`,
    content: "",
    sender_id: params.senderId,
    is_read: true,
    created_at: new Date().toISOString(),
    metadata: {
      kind: "local_phone_policy_block",
      originalContent: params.originalContent,
    },
  }
}
