import { NextResponse } from "next/server"
import { z } from "zod"
import { sendConversationReply } from "@/app/actions/messages"
import { composerUnlockTokenSchema } from "@/lib/validations/composer-unlock"

const bodySchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().trim().min(1).max(8000),
  composer_unlock_token: composerUnlockTokenSchema,
})

/**
 * Cookie-auth send for marketplace DMs. Route handler (not a Server Action) so
 * leaving `/messages` does not abort the insert the way a Server Action POST can.
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
    return NextResponse.json({ error: "Invalid message" }, { status: 400 })
  }

  try {
    const result = await sendConversationReply(parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[api/messages/send]", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
