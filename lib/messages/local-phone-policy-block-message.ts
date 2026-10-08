import { z } from "zod"
import {
  MESSAGE_POLICY_REASON_CODES,
  type MessagePolicyReasonCode,
} from "@/lib/messages/fraud-reason-codes"

export const LOCAL_POLICY_BLOCK_ID_PREFIX = "local-policy-block-" as const

/** Optimistic composer rows, replaced when the inserted row comes back. */
export const PENDING_THREAD_MESSAGE_ID_PREFIX = "pending-" as const

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

function messageTimestamp(createdAt: string): number {
  const parsed = Date.parse(createdAt)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Keeps client-only rows when a thread refetch is stale.
 * Policy reminders never exist on the server. Pending sends stay until a row
 * with the same sender and body arrives. Any local row newer than the snapshot
 * stays too, so a live bubble is not wiped by a cached reload.
 */
export function mergeServerMessagesPreservingLocalPolicyBlocks<
  T extends {
    id: string
    created_at: string
    metadata?: unknown | null
    content?: string
    sender_id?: string
  },
>(previous: T[], serverRows: T[]): T[] {
  const seen = new Set(serverRows.map((m) => m.id))
  let newestServer = 0
  for (const row of serverRows) {
    newestServer = Math.max(newestServer, messageTimestamp(row.created_at))
  }
  const merged = [...serverRows] as T[]
  for (const message of previous) {
    if (seen.has(message.id)) continue
    const pending = message.id.startsWith(PENDING_THREAD_MESSAGE_ID_PREFIX)
    const policyBlock = parseLocalPolicyBlockMetadata(message.metadata) != null
    if (pending) {
      const confirmed = serverRows.some(
        (row) => row.content === message.content && row.sender_id === message.sender_id,
      )
      if (confirmed) continue
    } else if (!policyBlock && messageTimestamp(message.created_at) <= newestServer) {
      continue
    }
    seen.add(message.id)
    merged.push(message)
  }
  merged.sort((a, b) => messageTimestamp(a.created_at) - messageTimestamp(b.created_at))
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
