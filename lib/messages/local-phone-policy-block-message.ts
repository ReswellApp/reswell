import { z } from "zod"
import {
  MESSAGE_POLICY_REASON_CODES,
  type MessagePolicyReasonCode,
} from "@/lib/messages/fraud-reason-codes"

export const LOCAL_POLICY_BLOCK_ID_PREFIX = "local-policy-block-" as const

/** @deprecated Use {@link LOCAL_POLICY_BLOCK_ID_PREFIX} */
export const LOCAL_PHONE_POLICY_BLOCK_ID_PREFIX = LOCAL_POLICY_BLOCK_ID_PREFIX

export const localPolicyBlockMetadataSchema = z.object({
  kind: z.literal("local_policy_block"),
  reasonCode: z.enum(MESSAGE_POLICY_REASON_CODES),
  originalContent: z.string(),
})

/** Legacy rows from before policy generalization. */
export const legacyLocalPhonePolicyBlockMetadataSchema = z.object({
  kind: z.literal("local_phone_policy_block"),
  originalContent: z.string(),
})

export type LocalPolicyBlockMetadata = z.infer<typeof localPolicyBlockMetadataSchema>

export function parseLocalPolicyBlockMetadata(metadata: unknown): LocalPolicyBlockMetadata | null {
  const parsed = localPolicyBlockMetadataSchema.safeParse(metadata)
  if (parsed.success) return parsed.data

  const legacy = legacyLocalPhonePolicyBlockMetadataSchema.safeParse(metadata)
  if (legacy.success) {
    return {
      kind: "local_policy_block",
      reasonCode: "phone_like",
      originalContent: legacy.data.originalContent,
    }
  }

  return null
}

/** @deprecated Use {@link parseLocalPolicyBlockMetadata} */
export function parseLocalPhonePolicyBlockMetadata(metadata: unknown): LocalPolicyBlockMetadata | null {
  return parseLocalPolicyBlockMetadata(metadata)
}

/**
 * Keeps client-only policy reminders when the thread is re-fetched from Supabase.
 */
export function mergeServerMessagesPreservingLocalPolicyBlocks<
  T extends { id: string; created_at: string; metadata?: unknown | null },
>(previous: T[], serverRows: T[]): T[] {
  const localOnly = previous.filter((m) => parseLocalPolicyBlockMetadata(m.metadata) != null)
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

/** @deprecated Use {@link mergeServerMessagesPreservingLocalPolicyBlocks} */
export const mergeServerMessagesPreservingLocalPhoneBlocks = mergeServerMessagesPreservingLocalPolicyBlocks

export function createLocalPolicyBlockMessage(params: {
  senderId: string
  originalContent: string
  reasonCode: MessagePolicyReasonCode
  id?: string
}): {
  id: string
  content: string
  sender_id: string
  is_read: boolean
  created_at: string
  metadata: LocalPolicyBlockMetadata
} {
  return {
    id: params.id ?? `${LOCAL_POLICY_BLOCK_ID_PREFIX}${crypto.randomUUID()}`,
    content: "",
    sender_id: params.senderId,
    is_read: true,
    created_at: new Date().toISOString(),
    metadata: {
      kind: "local_policy_block",
      reasonCode: params.reasonCode,
      originalContent: params.originalContent,
    },
  }
}

/** @deprecated Use {@link createLocalPolicyBlockMessage} */
export function createLocalPhonePolicyBlockMessage(params: {
  senderId: string
  originalContent: string
  id?: string
}): ReturnType<typeof createLocalPolicyBlockMessage> {
  return createLocalPolicyBlockMessage({
    ...params,
    reasonCode: "phone_like",
  })
}
