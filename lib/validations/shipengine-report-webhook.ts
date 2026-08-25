import { z } from "zod"

export const shipEngineReportWebhookSchema = z.object({
  resource_type: z.literal("API_REPORT_COMPLETE"),
  resource_url: z.string().optional(),
  data: z
    .object({
      report_type: z.string().optional(),
      created_at: z.string().optional(),
      report_url: z
        .object({
          href: z.string().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .optional(),
})

export type ShipEngineReportWebhookPayload = z.infer<typeof shipEngineReportWebhookSchema>

const REPORT_ID_RE = /rpt_[a-zA-Z0-9_-]+/

export function extractShipEngineReportId(payload: ShipEngineReportWebhookPayload): string | null {
  const href = payload.data?.report_url?.href ?? payload.resource_url ?? ""
  const match = href.match(REPORT_ID_RE)
  return match?.[0] ?? null
}
