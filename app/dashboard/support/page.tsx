import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { listHelpHubOrdersService, listUserSupportCasesService } from "@/lib/services/supportCases"
import { HelpHubClient } from "@/components/features/support/help-hub-client"
import {
  parseHelpHubIntent,
  parseHelpHubRole,
  parseOrderHelpIssue,
} from "@/lib/help/help-hub-intents"

export const metadata = privatePageMetadata({
  title: "Support — Reswell",
  description: "Chat with Reswell Support.",
  path: "/dashboard/support",
})

export default async function DashboardSupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    intent?: string
    orderId?: string
    issue?: string
    role?: string
    conversationId?: string
  }>
}) {
  const { user } = await getCachedDashboardSession()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/support")
  }

  const params = await searchParams
  const initialIntent = parseHelpHubIntent(params.intent)

  const [cases, orders] = await Promise.all([
    listUserSupportCasesService(user.id, "all"),
    listHelpHubOrdersService(user.id),
  ])

  return (
    <HelpHubClient
      cases={cases}
      orders={orders}
      userId={user.id}
      signedIn
      historyOpen={params.status === "resolved" || params.status === "all"}
      initialIntent={initialIntent}
      initialOrderId={params.orderId ?? null}
      initialIssue={parseOrderHelpIssue(params.issue)}
      initialRole={parseHelpHubRole(params.role)}
      relatedConversationId={params.conversationId ?? null}
    />
  )
}
