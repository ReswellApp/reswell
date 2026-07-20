"use server"

import {
  createOpsFixTicketService,
  runOpsIngestNowService,
  updateOpsFixTicketService,
  updateOpsGroupStatusService,
} from "@/lib/services/opsAdmin"

export async function updateOpsGroupStatusAction(raw: unknown) {
  return updateOpsGroupStatusService(raw)
}

export async function createOpsFixTicketAction(raw: unknown) {
  return createOpsFixTicketService(raw)
}

export async function updateOpsFixTicketAction(raw: unknown) {
  return updateOpsFixTicketService(raw)
}

export async function runOpsIngestNowAction() {
  return runOpsIngestNowService()
}
