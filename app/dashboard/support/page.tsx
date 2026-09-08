import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import {
  countOpenUserSupportCasesService,
  listUserSupportCasesService,
} from "@/lib/services/supportCases"
import { SupportCasesList } from "@/components/features/dashboard/support/support-cases-list"
import { Button } from "@/components/ui/button"
import { DashboardPageSkeleton } from "@/components/features/dashboard/dashboard-page-skeleton"
import type { UserSupportTicketFilter } from "@/lib/db/contactMessages"
import { helpHubHref } from "@/lib/help/help-hub-intents"

export const metadata = privatePageMetadata({
  title: "Support — Reswell",
  description: "Chat with Reswell Support.",
  path: "/dashboard/support",
})

function parseFilter(raw: string | undefined): UserSupportTicketFilter {
  if (raw === "all" || raw === "resolved") return raw
  // Default: open conversations only
  return "open"
}

async function SupportCasesContent({
  userId,
  filter,
  openCount,
}: {
  userId: string
  filter: UserSupportTicketFilter
  openCount: number
}) {
  const cases = await listUserSupportCasesService(userId, filter)
  return <SupportCasesList cases={cases} activeFilter={filter} openCount={openCount} />
}

export default async function DashboardSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { user } = await getCachedDashboardSession()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/support")
  }

  const params = await searchParams
  const filter = parseFilter(params.status)
  const openCount = await countOpenUserSupportCasesService(user.id)

  return (
    <div className="mx-auto max-w-lg space-y-1 sm:max-w-xl">
      <div className="flex items-center justify-between gap-3 pb-2 pt-1">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Support</h1>
          <p className="text-[13px] text-muted-foreground">Chat with the Reswell team</p>
        </div>
        {openCount === 0 ? (
          <Button asChild size="sm" className="rounded-full px-3.5">
            <Link href={helpHubHref()}>
              <Plus className="mr-1 h-4 w-4" />
              New
            </Link>
          </Button>
        ) : null}
      </div>

      <Suspense fallback={<DashboardPageSkeleton />}>
        <SupportCasesContent userId={user.id} filter={filter} openCount={openCount} />
      </Suspense>
    </div>
  )
}
