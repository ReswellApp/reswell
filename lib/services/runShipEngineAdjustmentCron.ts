import {
  sendShipEngineAdjustmentAdminAlert,
  type ShipEngineAdjustmentAdminAlertSummary,
} from "@/lib/services/shipEngineAdjustmentAdminAlert"
import {
  syncShipEngineLabelAdjustments,
  type SyncShipEngineAdjustmentsSummary,
} from "@/lib/services/syncShipEngineLabelAdjustments"

export type ShipEngineAdjustmentCronSummary = {
  sync: SyncShipEngineAdjustmentsSummary
  alert: ShipEngineAdjustmentAdminAlertSummary
}

export async function runShipEngineAdjustmentCron(): Promise<
  | { ok: true; summary: ShipEngineAdjustmentCronSummary }
  | { ok: false; error: string }
> {
  const sync = await syncShipEngineLabelAdjustments()
  if (!sync.ok) return sync

  const alert = await sendShipEngineAdjustmentAdminAlert()
  if (!alert.ok) return alert

  return {
    ok: true,
    summary: {
      sync: sync.summary,
      alert: alert.summary,
    },
  }
}
