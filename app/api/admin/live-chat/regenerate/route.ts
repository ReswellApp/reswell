import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { regenerateLiveChatReplyAdminService } from "@/lib/services/liveChatAdmin"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => null)
    const result = await regenerateLiveChatReplyAdminService(raw)
    if ("error" in result) {
      const status =
        result.error === "Unauthorized" || result.error === "Forbidden" ? 401 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/support-reply-examples")
    return NextResponse.json({ data: result.message }, { status: 200 })
  } catch (error) {
    console.error("POST /api/admin/live-chat/regenerate", error)
    return NextResponse.json({ error: "Could not regenerate that reply." }, { status: 500 })
  }
}
