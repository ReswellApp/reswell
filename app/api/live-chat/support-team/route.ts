import { NextResponse } from "next/server"
import { getLiveChatSupportTeamDisplayService } from "@/lib/services/liveChatSupportTeamDisplay"
import {
  getLiveChatSupportOnlineCountService,
  listLiveChatSupportOnlineMemberIdsService,
} from "@/lib/services/liveChatPresence"
import { assertLiveChatVisitorAccess } from "@/lib/services/liveChatVisitorAccess"

export async function GET() {
  try {
    const access = await assertLiveChatVisitorAccess()
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const [members, agentsOnlineCount, onlineMemberIds] = await Promise.all([
      getLiveChatSupportTeamDisplayService(),
      getLiveChatSupportOnlineCountService(),
      listLiveChatSupportOnlineMemberIdsService(),
    ])
    return NextResponse.json(
      {
        data: {
          members,
          agents_online: agentsOnlineCount > 0,
          agents_online_count: agentsOnlineCount,
          online_member_ids: onlineMemberIds,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("GET /api/live-chat/support-team", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
