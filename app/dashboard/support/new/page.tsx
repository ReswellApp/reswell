import { redirect } from "next/navigation"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { helpHubHref } from "@/lib/help/help-hub-intents"
import {
  parseHelpHubIntent,
  parseHelpHubRole,
  parseOrderHelpIssue,
} from "@/lib/help/help-hub-intents"

/** Legacy intake URL — the hub now lives on /dashboard/support. */
export default async function HelpHubRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{
    intent?: string
    orderId?: string
    issue?: string
    role?: string
    conversationId?: string
  }>
}) {
  const { user } = await getCachedDashboardSession()
  const params = await searchParams
  const href = helpHubHref({
    intent: parseHelpHubIntent(params.intent) ?? undefined,
    orderId: params.orderId,
    issue: parseOrderHelpIssue(params.issue) ?? undefined,
    role: parseHelpHubRole(params.role) ?? undefined,
    conversationId: params.conversationId,
  })

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(href)}`)
  }

  redirect(href)
}
