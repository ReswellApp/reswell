import { NextResponse } from "next/server"
import { z } from "zod"
import { sendConversationMediaReply } from "@/app/actions/messages"
import { composerUnlockTokenSchema } from "@/lib/validations/composer-unlock"
import { marketplaceMessageAttachmentInputSchema } from "@/lib/validations/marketplace-message-attachment"

const bodySchema = z.object({
  conversation_id: z.string().uuid(),
  attachment: marketplaceMessageAttachmentInputSchema,
  caption: z.string().max(5000).optional(),
  composer_unlock_token: composerUnlockTokenSchema,
})

/**
 * Cookie-auth media send. Route handler so leaving the thread does not abort
 * the insert the way a Server Action POST can.
 */
export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid attachment" }, { status: 400 })
  }

  try {
    const result = await sendConversationMediaReply(parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[api/messages/send-media]", error)
    return NextResponse.json({ error: "Could not send message" }, { status: 500 })
  }
}
