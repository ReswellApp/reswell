"use server"

import { revalidatePath } from "next/cache"

import {
  runWorkforceAgentAsAdmin,
  toggleWorkforceAgent,
} from "@/lib/services/workforceAgents"
import {
  workforceAgentRunSchema,
  workforceAgentToggleSchema,
} from "@/lib/validations/workforce-agents"

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}): string {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find(
    (messages) => messages && messages.length > 0,
  )
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

export async function toggleWorkforceAgentAction(raw: unknown) {
  const parsed = workforceAgentToggleSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }

  const result = await toggleWorkforceAgent(parsed.data)
  if (!result.ok) return { error: result.error }

  revalidatePath("/admin/agents")
  return { success: true as const, enabled: result.data.enabled }
}

export async function runWorkforceAgentAction(raw: unknown) {
  const parsed = workforceAgentRunSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }

  const result = await runWorkforceAgentAsAdmin(parsed.data)
  revalidatePath("/admin/agents")
  if (!result.ok) return { error: result.error }

  return {
    success: true as const,
    status: result.data.status,
    summary: result.data.summary,
    runId: result.data.runId,
  }
}
