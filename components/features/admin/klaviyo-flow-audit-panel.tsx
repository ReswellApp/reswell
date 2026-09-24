import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  KLAVIYO_DUPLICATE_GROUPS,
  KLAVIYO_FLOW_CAUTIONS,
  KLAVIYO_RECOMMENDED_FLOWS,
  klaviyoActiveUnusedTriggers,
  klaviyoMetricFlowDisposition,
} from "@/lib/klaviyo/flow-audit"

const DISPOSITION_LABEL = {
  companion_no_email: "Fires — do not email",
  too_broad: "Fires — too broad to email",
  ops_only: "Internal only",
  customer_email: "Email this",
} as const

/**
 * Static audit of emitted Klaviyo triggers. Live send/draft status stays on the Email flows tab.
 */
export function KlaviyoFlowAuditPanel() {
  const unused = klaviyoActiveUnusedTriggers()
  const newFlows = KLAVIYO_RECOMMENDED_FLOWS.filter((flow) => flow.status === "new_metric")

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trigger audit</CardTitle>
          <p className="text-xs text-muted-foreground font-normal mt-1">
            Built from the metrics this app emits. A trigger can be active in code and still be the
            wrong thing to email. Live vs draft flows are on the Email flows tab.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-2xl font-semibold">{unused.length}</p>
            <p className="text-xs text-muted-foreground">Active triggers to leave off customer email</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{KLAVIYO_DUPLICATE_GROUPS.length}</p>
            <p className="text-xs text-muted-foreground">Duplicate groups that double-send if both are emailed</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{newFlows.length}</p>
            <p className="text-xs text-muted-foreground">New metrics to build a flow on</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Duplicates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {KLAVIYO_DUPLICATE_GROUPS.map((group) => (
            <div key={group.id} className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-medium">{group.title}</p>
              <p className="text-xs text-muted-foreground">{group.why}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.emailThese.map((metric) => (
                  <Badge key={metric} variant="secondary">
                    Email {metric}
                  </Badge>
                ))}
                {group.doNotAlsoEmail.map((metric) => (
                  <Badge key={metric} variant="outline">
                    Skip {metric}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active, not for email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {unused.map((row) => (
            <div key={row.metric} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{row.metric}</span>
              <Badge variant="outline">{DISPOSITION_LABEL[row.disposition]}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Watch these pairs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {KLAVIYO_FLOW_CAUTIONS.map((caution) => (
            <div key={caution.title}>
              <p className="text-sm font-medium">{caution.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{caution.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Flows to match Reverb, eBay, and PangoBooks</CardTitle>
          <p className="text-xs text-muted-foreground font-normal mt-1">
            Paste the marketplace nudge HTML from{" "}
            <span className="font-medium text-foreground">marketplace-nudge-email-liquid.ts</span>{" "}
            into Offer Declined, Counteroffer Declined, Offer Expiring, Seller Ship Reminder, and
            Pickup Reminder. Other rows use the existing metric templates.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {KLAVIYO_RECOMMENDED_FLOWS.map((flow) => (
            <div key={flow.id} className="space-y-1 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{flow.metric}</p>
                <Badge variant="outline">{flow.kind}</Badge>
                <Badge variant="secondary">
                  {klaviyoMetricFlowDisposition(flow.metric) === "customer_email"
                    ? flow.status === "new_metric"
                      ? "New metric"
                      : "Already emitted"
                    : "Check disposition"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{flow.peer}</p>
              <p className="text-xs">
                <span className="font-medium">{flow.who}.</span> {flow.when}
              </p>
              <p className="text-xs text-muted-foreground">Exit: {flow.exit}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
