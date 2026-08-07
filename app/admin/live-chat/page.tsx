import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { LiveChatAdminClient } from "@/components/features/admin/live-chat-admin-client"
import { getLiveChatStaffProfileService } from "@/lib/services/liveChatAdmin"

export const metadata = privatePageMetadata({
  title: "Live chat — Admin — Reswell",
  description: "Real-time live chat support queue for Reswell visitors.",
  path: "/admin/live-chat",
})

export default async function AdminLiveChatPage() {
  const staff = await getLiveChatStaffProfileService()
  if ("error" in staff) {
    redirect("/admin")
  }

  return (
    <LiveChatAdminClient
      initialStaff={{
        userId: staff.userId,
        displayName: staff.displayName,
      }}
    />
  )
}
