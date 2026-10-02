import { NextResponse } from "next/server"
import { bootstrapShipEngineAdjustmentAdminAlertMetric } from "@/lib/services/shipEngineAdjustmentAdminAlert"

/**
 * Seeds the Klaviyo metric used by the ShipEngine adjustment admin SMS flow.
 * Protected with CRON_SECRET when configured.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await bootstrapShipEngineAdjustmentAdminAlertMetric()
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      data: result,
      message:
        'Metric seeded. Create a Klaviyo flow triggered by "ShipEngine Label Adjustment Alert", filter reswell_metric_seed != true, and add a transactional SMS using {{ event.sms_message }}.',
    })
  } catch (error) {
    console.error(
      "[klaviyo] ShipEngine adjustment alert metric bootstrap failed:",
      error,
    )
    return NextResponse.json(
      { error: "Could not seed the ShipEngine adjustment alert metric" },
      { status: 500 },
    )
  }
}
