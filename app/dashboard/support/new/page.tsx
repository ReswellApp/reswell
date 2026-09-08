import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { listHelpHubOrdersService } from "@/lib/services/supportCases"
import { getLatestOpenUserSupportCaseService } from "@/lib/services/supportCaseOpenLimit"
import { supportCaseResponseHref } from "@/lib/utils/support-case-paths"
import { HelpHubClient } from "@/components/features/support/help-hub-client"
import type { HelpHubIntentId, OrderHelpIssueId } from "@/lib/types/supportCase"
import { HELP_HUB_INTENTS } from "@/lib/help/help-hub-intents"

export const metadata = privatePageMetadata({
  title: "Get help — Reswell",
  description: "Choose what you need help with and open a case with the Reswell team.",
  path: "/dashboard/support/new",
})

function parseIntent(raw: string | undefined): HelpHubIntentId | null {
  if (!raw) return null
  return HELP_HUB_INTENTS.some((i) => i.id === raw) ? (raw as HelpHubIntentId) : null
}

function parseIssue(raw: string | undefined): OrderHelpIssueId | null {
  if (raw === "question" || raw === "cancel" || raw === "claim") return raw
  return null
}

function parseRole(raw: string | undefined): "buyer" | "seller" | null {
  if (raw === "buyer" || raw === "seller") return raw
  return null
}

export default async function HelpHubPage({
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
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/support/new")
  }

  const openCase = await getLatestOpenUserSupportCaseService(user.id)
  if (openCase) {
    redirect(supportCaseResponseHref(openCase.id))
  }

  const params = await searchParams
  const orders = await listHelpHubOrdersService(user.id)

  return (
    <HelpHubClient
      orders={orders}
      userId={user.id}
      initialIntent={parseIntent(params.intent)}
      initialOrderId={params.orderId ?? null}
      initialIssue={parseIssue(params.issue)}
      initialRole={parseRole(params.role)}
      relatedConversationId={params.conversationId ?? null}
    />
  )
}
