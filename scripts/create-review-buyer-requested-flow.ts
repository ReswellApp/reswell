/**
 * Create the Klaviyo **Please review this buyer** flow (metric Review Buyer Requested).
 *
 * Usage:
 *   npx tsx scripts/create-review-buyer-requested-flow.ts
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { KLAVIYO_API_REVISION } from "@/lib/klaviyo/send-event"
import { KLAVIYO_REVIEW_BUYER_REQUESTED_EMAIL_HTML } from "@/lib/klaviyo/review-buyer-requested-email-liquid"
import { REVIEW_BUYER_REQUESTED_METRIC } from "@/lib/klaviyo/track-review-buyer-requested"

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  try {
    const content = readFileSync(filePath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!value) continue
      if (process.env[key]?.trim()) continue
      process.env[key] = value
    }
  } catch {
    // optional
  }
}

const FLOW_NAME = "Please review this buyer"
const TEMPLATE_NAME = "Please review this buyer"
const METRIC_ID = "WetyVq"

function headers(apiKey: string, contentType = false): HeadersInit {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: KLAVIYO_API_REVISION,
    Accept: "application/vnd.api+json",
    ...(contentType ? { "Content-Type": "application/vnd.api+json" } : {}),
  }
}

async function klaviyoJson(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown; detail: string }> {
  const res = await fetch(`https://a.klaviyo.com${path}`, {
    method,
    headers: headers(apiKey, body != null),
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: res.ok, status: res.status, data, detail: text.slice(0, 1200) }
}

async function main() {
  loadEnvFile(".env.local")
  loadEnvFile(".env")
  const apiKey = process.env.KLAVIYO_API_KEY?.trim()
  if (!apiKey) {
    console.error("KLAVIYO_API_KEY is not set")
    process.exit(1)
  }

  const metricsPage = await klaviyoJson(
    apiKey,
    "GET",
    `/api/metrics/?include=flow-triggers&fields[metric]=name&fields[flow]=name,status,archived`,
  )
  if (!metricsPage.ok) {
    console.error("Failed to list metrics", metricsPage.status, metricsPage.detail)
    process.exit(1)
  }

  const metricsDoc = metricsPage.data as {
    data?: Array<{
      id: string
      attributes?: { name?: string }
      relationships?: { "flow-triggers"?: { data?: Array<{ id: string }> } }
    }>
    included?: Array<{
      id: string
      type: string
      attributes?: { name?: string; status?: string; archived?: boolean }
    }>
  }

  const metric = (metricsDoc.data ?? []).find(
    (m) => m.attributes?.name === REVIEW_BUYER_REQUESTED_METRIC,
  )
  const metricId = metric?.id ?? METRIC_ID
  const existingFlowIds = metric?.relationships?.["flow-triggers"]?.data?.map((d) => d.id) ?? []
  const existingLive = (metricsDoc.included ?? []).find(
    (inc) =>
      inc.type === "flow" &&
      existingFlowIds.includes(inc.id) &&
      inc.attributes?.archived !== true,
  )
  if (existingLive) {
    console.log("Flow already exists for Review Buyer Requested:", {
      id: existingLive.id,
      name: existingLive.attributes?.name,
      status: existingLive.attributes?.status,
    })
    return
  }

  const templateRes = await klaviyoJson(apiKey, "POST", "/api/templates/", {
    data: {
      type: "template",
      attributes: {
        name: TEMPLATE_NAME,
        editor_type: "CODE",
        html: KLAVIYO_REVIEW_BUYER_REQUESTED_EMAIL_HTML,
        text: "Please review this buyer. Open your sale page on Reswell to leave a star rating.",
      },
    },
  })
  if (!templateRes.ok) {
    console.error("Failed to create template", templateRes.status, templateRes.detail)
    process.exit(1)
  }
  const templateId = (templateRes.data as { data?: { id?: string } }).data?.id
  if (!templateId) {
    console.error("Template created but no id", templateRes.data)
    process.exit(1)
  }
  console.log("Created template", templateId)

  const flowRes = await klaviyoJson(apiKey, "POST", "/api/flows/?additional-fields[flow]=definition", {
    data: {
      type: "flow",
      attributes: {
        name: FLOW_NAME,
        definition: {
          triggers: [
            {
              type: "metric",
              id: metricId,
              trigger_filter: null,
            },
          ],
          profile_filter: null,
          actions: [
            {
              temporary_id: "delay-1",
              type: "time-delay",
              data: {
                unit: "hours",
                value: 1,
                secondary_value: 0,
                timezone: "profile",
              },
              links: { next: "email-1" },
            },
            {
              temporary_id: "email-1",
              type: "send-email",
              data: {
                message: {
                  from_email: "hayden@reswell.app",
                  from_label: "Reswell",
                  reply_to_email: null,
                  cc_email: null,
                  bcc_email: null,
                  subject_line: "Please review {{ event.buyer_display_name }}",
                  preview_text: "{{ event.Title }}",
                  template_id: templateId,
                  smart_sending_enabled: true,
                  transactional: false,
                  add_tracking_params: false,
                  custom_tracking_params: null,
                  additional_filters: null,
                  name: "Please review this buyer",
                },
                status: "live",
              },
              links: { next: null },
            },
          ],
          entry_action_id: "delay-1",
        },
      },
    },
  })

  if (!flowRes.ok) {
    console.error("Failed to create flow", flowRes.status, flowRes.detail)
    process.exit(1)
  }

  const flowId = (flowRes.data as { data?: { id?: string } }).data?.id
  console.log("Created flow", flowId, FLOW_NAME)

  if (flowId) {
    const live = await klaviyoJson(apiKey, "PATCH", `/api/flows/${flowId}/`, {
      data: {
        type: "flow",
        id: flowId,
        attributes: { status: "live" },
      },
    })
    if (!live.ok) {
      console.warn("Flow created but could not set live:", live.status, live.detail)
    } else {
      console.log("Flow is live.")
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
