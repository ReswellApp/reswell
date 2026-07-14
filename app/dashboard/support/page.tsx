import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LifeBuoy } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { listUserSupportTicketsService } from "@/lib/services/userSupportTickets"
import { countOpenContactMessagesForUser } from "@/lib/db/contactMessages"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import { SupportTicketsList } from "@/components/features/dashboard/support/support-tickets-list"
import { MessagesSupportDialog } from "@/components/features/messages/messages-support-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DashboardPageSkeleton } from "@/components/features/dashboard/dashboard-page-skeleton"
import type { UserSupportTicketFilter } from "@/lib/db/contactMessages"

export const metadata = privatePageMetadata({
  title: "Support — Reswell",
  description: "View and manage your Reswell support requests.",
  path: "/dashboard/support",
})

function parseFilter(raw: string | undefined): UserSupportTicketFilter {
  if (raw === "open" || raw === "resolved") return raw
  return "all"
}

async function SupportTicketsContent({
  userId,
  filter,
  openCount,
}: {
  userId: string
  filter: UserSupportTicketFilter
  openCount: number
}) {
  const tickets = await listUserSupportTicketsService(userId, filter)
  return <SupportTicketsList tickets={tickets} activeFilter={filter} openCount={openCount} />
}

export default async function DashboardSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { supabase, user } = await getCachedDashboardSession()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/support")
  }

  const params = await searchParams
  const filter = parseFilter(params.status)

  const openCount = await countOpenContactMessagesForUser(supabase, user.id)

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Support"
        description={
          <>
            Track open requests, read team replies, and continue conversations. For marketplace chats with
            other members, use{" "}
            <Link href="/messages" className="text-primary underline underline-offset-2">
              Messages
            </Link>
            .
          </>
        }
        actions={
          <MessagesSupportDialog triggerLabel="New request" variant="default" size="sm" />
        }
      />

      {openCount === 0 ? null : (
        <Card className="rounded-xl border-primary/20 bg-primary/[0.04]">
          <CardContent className="flex items-center gap-3 px-4 py-3 text-sm">
            <LifeBuoy className="h-4 w-4 shrink-0 text-primary" />
            <span>
              You have{" "}
              <strong className="font-semibold text-foreground">
                {openCount} open {openCount === 1 ? "request" : "requests"}
              </strong>{" "}
              with our team.
            </span>
          </CardContent>
        </Card>
      )}

      <Suspense fallback={<DashboardPageSkeleton />}>
        <SupportTicketsContent userId={user.id} filter={filter} openCount={openCount} />
      </Suspense>

      <Card className="rounded-xl border-border/70 bg-muted/15">
        <CardContent className="space-y-2 px-4 py-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Need help right now?</p>
          <p>
            Browse the{" "}
            <Link href="/faq" className="text-primary underline underline-offset-2">
              FAQ
            </Link>{" "}
            for instant answers, or{" "}
            <Link href="/contact" className="text-primary underline underline-offset-2">
              contact us
            </Link>{" "}
            from the website while signed in so requests appear here automatically.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link href="/contact">Contact form</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
