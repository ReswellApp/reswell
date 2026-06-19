"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getConsignmentStoreBySlug } from "@/lib/db/consignmentStores"
import { replyToStoreConversation } from "@/lib/services/storeConversationReply"

const schema = z.object({
  storeSlug: z.string().min(1),
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1, "Message cannot be empty.").max(5000),
})

export async function replyToStoreConversationAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const parsed = schema.safeParse({
    storeSlug: formData.get("storeSlug"),
    conversationId: formData.get("conversationId"),
    content: formData.get("content"),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid request." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "You must be signed in." }
  }

  const store = await getConsignmentStoreBySlug(supabase, parsed.data.storeSlug)
  if (!store) {
    return { error: "Store not found." }
  }

  const result = await replyToStoreConversation({
    staffProfileId: user.id,
    storeId: store.id,
    conversationId: parsed.data.conversationId,
    content: parsed.data.content,
  })

  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePath(`/stores/${parsed.data.storeSlug}/messages/${parsed.data.conversationId}`)
  revalidatePath(`/stores/${parsed.data.storeSlug}/messages`)
  return { success: true }
}
