"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  FRAUD_MESSAGES_ADMIN_LIST_SELECT,
  type FraudMessageRow,
} from "@/lib/db/fraudMessages"
import {
  isMessagePolicyReasonCode,
  messagePolicyReasonLabel,
} from "@/lib/messages/fraud-reason-codes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExternalLink, Loader2, ShieldAlert } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function llmReviewBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", className: "bg-red-50 text-red-800" }
    case "dismissed":
      return { label: "Not fraud", className: "bg-emerald-50 text-emerald-800" }
    case "unavailable":
      return { label: "Unreviewed", className: "bg-muted text-muted-foreground" }
    default:
      return { label: "Pending", className: "bg-amber-50 text-amber-900" }
  }
}

export function FraudMessagesAdminClient() {
  const [rows, setRows] = useState<FraudMessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("fraud_messages")
      .select(FRAUD_MESSAGES_ADMIN_LIST_SELECT)
      .order("created_at", { ascending: false })
      .limit(200)

    setLoading(false)
    if (error) {
      console.error("[admin fraud_messages]", error.message)
      toast.error("Could not load intercepted messages")
      setRows([])
      return
    }

    setRows((data ?? []) as unknown as FraudMessageRow[])
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldAlert className="h-5 w-5" aria-hidden />
              Intercepted marketplace chats
            </CardTitle>
            <CardDescription>
              Flagged marketplace DMs. Phone numbers, email, Venmo/Zelle/Cash App, cash
              requests, and phishing are blocked before delivery. Gemini confirms fraud or
              marks innocent wording as not fraud. Accounts newer than 24 hours are
              permanently banned after 3 blocked scam messages.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Refreshing
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {loading && rows.length === 0 ? (
            <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing intercepted recently.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">When</TableHead>
                  <TableHead className="w-[120px]">Reason</TableHead>
                  <TableHead className="w-[120px]">Review</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="w-[120px]">Thread</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const badge = llmReviewBadge(r.llm_review_status)
                  return (
                    <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap align-top text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="align-top text-sm whitespace-nowrap">
                      {isMessagePolicyReasonCode(r.reason_code)
                        ? messagePolicyReasonLabel(r.reason_code)
                        : r.reason_code}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                        {r.llm_review_rationale ? (
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            {r.llm_review_rationale}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {r.sender_profile?.display_name ?? "—"}
                      <div className="font-mono text-[11px] text-muted-foreground">{r.sender_id.slice(0, 8)}…</div>
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {r.recipient_profile?.display_name ?? "—"}
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {r.recipient_id.slice(0, 8)}…
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[min(440px,50vw)] align-top whitespace-pre-wrap break-words text-sm">
                      {r.content}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button variant="link" className="h-auto p-0 text-sm" asChild>
                        <Link href={`/admin/messages/${r.conversation_id}`}>
                          Open
                          <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
