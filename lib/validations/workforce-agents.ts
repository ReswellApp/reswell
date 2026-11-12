import { z } from "zod"

import { WORKFORCE_AGENT_IDS } from "@/lib/workforce-agents/types"

export const workforceAgentIdSchema = z.enum(WORKFORCE_AGENT_IDS)

export const workforceAgentToggleSchema = z.object({
  agentId: workforceAgentIdSchema,
  enabled: z.boolean(),
})

export const workforceAgentRunSchema = z.object({
  agentId: workforceAgentIdSchema,
})
