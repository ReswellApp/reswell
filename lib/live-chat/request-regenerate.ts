import type { SupportReplyDraftRating } from "@/lib/validations/supportReplyDraft"

export async function requestLiveChatReplyRegenerate(input: {
  sessionId: string
  messageId: string
  rating?: SupportReplyDraftRating | null
  note?: string
}): Promise<{ id: string; content: string; created_at: string } | { error: string }> {
  const response = await fetch("/api/admin/live-chat/regenerate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: input.sessionId,
      message_id: input.messageId,
      rating: input.rating ?? undefined,
      rating_note: input.note?.trim() || undefined,
    }),
  })
  const body = (await response.json().catch(() => null)) as
    | { data?: { id: string; content: string; created_at: string }; error?: string }
    | null
  if (!response.ok || !body?.data) {
    return { error: body?.error || "Could not regenerate that reply." }
  }
  return body.data
}
