import Link from "next/link"
import { ArrowLeft, Clock, LifeBuoy, MessageCircle } from "lucide-react"
import type { ContactMessageUserRow } from "@/lib/db/contactMessages"
import {
  formatSupportTicketReference,
  supportTicketDisplaySubject,
  USER_SUPPORT_STATUS_DESCRIPTION,
  USER_SUPPORT_STATUS_LABEL,
  userSupportStatusBadgeVariant,
} from "@/lib/utils/support-ticket-display"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LocalDateTime } from "@/components/ui/local-datetime"
import { cn } from "@/lib/utils"

interface SupportTicketDetailHeaderProps {
  ticket: ContactMessageUserRow
}

export function SupportTicketDetailHeader({ ticket }: SupportTicketDetailHeaderProps) {
  const subject = supportTicketDisplaySubject(ticket.subject, ticket.source)

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
        <Link href="/dashboard/support">
          <ArrowLeft className="h-4 w-4" />
          All requests
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={userSupportStatusBadgeVariant(ticket.support_status)}
              className={cn(
                "font-normal",
                ticket.support_status === "resolved" &&
                  "border-transparent bg-muted text-muted-foreground",
              )}
            >
              {USER_SUPPORT_STATUS_LABEL[ticket.support_status]}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {formatSupportTicketReference(ticket.id)}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{subject}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {USER_SUPPORT_STATUS_DESCRIPTION[ticket.support_status]}
          </p>
        </div>
      </div>

      <Card className="rounded-xl border-border/80 bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <LifeBuoy className="h-4 w-4 text-primary" />
            Your original request
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="whitespace-pre-wrap leading-relaxed text-foreground">{ticket.message}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Submitted{" "}
              <LocalDateTime iso={ticket.created_at} dateStyle="medium" timeStyle="short" />
            </span>
            <span>
              Last updated{" "}
              <LocalDateTime iso={ticket.updated_at} dateStyle="medium" timeStyle="short" />
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface SupportTicketThreadPendingProps {
  ticket: ContactMessageUserRow
}

export function SupportTicketThreadPending({ ticket }: SupportTicketThreadPendingProps) {
  return (
    <Card className="rounded-xl border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <MessageCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="max-w-md space-y-2">
          <p className="text-base font-medium text-foreground">Waiting for our team</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We received your request at <strong className="font-medium text-foreground">{ticket.email}</strong>.
            When a teammate picks this up, you&apos;ll see the conversation here and can reply in real time.
          </p>
          <p className="text-xs text-muted-foreground">
            You can also check{" "}
            <Link href="/messages" className="font-medium text-primary underline underline-offset-2">
              Messages
            </Link>{" "}
            if support has already opened a thread with you.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
