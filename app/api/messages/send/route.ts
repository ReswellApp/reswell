import { NextResponse } from "next/server"
import { z } from "zod"
import { sendConversationReply } from "@/app/actions/messages"
import { composerUnlockTokenSchema } from "@/lib/validations/composer-unlock"

export const maxDuration = 60

const bodySchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().trim().min(1).max(8000),
  composer_unlock_token: composerUnlockTokenSchema,
  client_id: z
    .string()
    .trim()
    .min(16)
    .max(80)
    .refine((value) => value.startsWith("pending-"), {
      message: "Invalid client id",
    })
    .optional(),
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
    const result = await sendConversationReply({
      conversation_id: parsed.data.conversation_id,
      content: parsed.data.content,
      composer_unlock_token: parsed.data.composer_unlock_token,
      client_id: parsed.data.client_id,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[api/messages/send]", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
