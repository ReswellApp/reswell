"use client"

import { format } from "date-fns"
import { LifeBuoy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type AdminOrderSupportRequest = {
  id: string
  request_type: string
  body: string
  contacted_seller_first: boolean | null
  created_at: string
}

function requestTypeLabel(t: string): string {
  switch (t) {
    case "help":
      return "Question"
    case "cancel_order":
      return "Cancel"
    case "refund_help":
      return "Protection claim"
    default:
      return t
  }
}

export function AdminOrderSupportSection({ requests }: { requests: AdminOrderSupportRequest[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LifeBuoy className="h-4 w-4 text-muted-foreground" />
          Support requests
        </CardTitle>
        <CardDescription>Buyer and seller requests tied to this order.</CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No support requests for this order.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((sr) => (
              <div key={sr.id} className="rounded-lg border border-border/60 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Badge variant="secondary">{requestTypeLabel(sr.request_type)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(sr.created_at), "MMM d, yyyy HH:mm")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{sr.body}</p>
                {sr.request_type === "refund_help" && sr.contacted_seller_first !== null ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Contacted seller first: {sr.contacted_seller_first ? "Yes" : "No"}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
