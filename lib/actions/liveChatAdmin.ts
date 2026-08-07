"use server"

import { revalidatePath } from "next/cache"
import {
  escalateLiveChatSessionAdminService,
  listLiveChatAdminQueueService,
  loadLiveChatAdminThreadService,
  sendLiveChatAgentMessageService,
  updateLiveChatSessionAdminService,
} from "@/lib/services/liveChatAdmin"

function revalidateLiveChatAdmin() {
  revalidatePath("/admin/live-chat")
}

export async function listLiveChatAdminQueueAction() {
  return listLiveChatAdminQueueService()
}

export async function loadLiveChatAdminThreadAction(sessionId: string) {
  return loadLiveChatAdminThreadService(sessionId)
}

export async function sendLiveChatAgentMessageAction(raw: unknown) {
  const result = await sendLiveChatAgentMessageService(raw)
  if ("success" in result && result.success) {
    revalidateLiveChatAdmin()
  }
  return result
}

export async function updateLiveChatSessionAdminAction(raw: unknown) {
  const result = await updateLiveChatSessionAdminService(raw)
  if ("success" in result && result.success) {
    revalidateLiveChatAdmin()
  }
  return result
}

export async function escalateLiveChatSessionAdminAction(raw: unknown) {
  const result = await escalateLiveChatSessionAdminService(raw)
  if ("success" in result && result.success) {
    revalidateLiveChatAdmin()
    revalidatePath("/admin/contact-messages")
  }
  return result
}
