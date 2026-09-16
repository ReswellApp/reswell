import { generateText, isStepCount, Output, tool } from "ai"
import { z } from "zod"
import { gatewayTagsForFeature } from "@/lib/llm/app-models"
import {
  CS_AGENT_GENERATE_TIMEOUT_MS,
  CS_AGENT_MAX_STEPS,
  csAgentSystemPrompt,
  defaultCsAgentReason,
  filterCsAgentCitations,
  formatCsAgentContextPack,
  type CsAgentContextPack,
  type CsAgentDraftOutput,
} from "@/lib/llm/cs-agent"
import { csAgentLlmSchema } from "@/lib/validations/supportReplyDraft"

export type CsAgentToolLookups = {
  lookupOrder: (query: string) => Promise<unknown>
  lookupTracking: (query: string) => Promise<unknown>
  refundEligibility: (query: string) => Promise<unknown>
  helpArticle: (query: string) => Promise<unknown>
  priorTickets: (query?: string) => Promise<unknown>
}

const querySchema = z.object({
  query: z
    .string()
    .trim()
    .max(160)
    .describe("Order number, order id, tracking number, help slug, or search text."),
})

function createCsAgentTools(lookups: CsAgentToolLookups, allowed: {
  helpSlugs: Set<string>
  orderRefs: Set<string>
  ticketIds: Set<string>
}) {
  const rememberOrder = (value: unknown) => {
    if (!value || typeof value !== "object") return
    const row = value as { orderNum?: unknown; id?: unknown; found?: unknown }
    if (row.found === false) return
    if (typeof row.orderNum === "string" && row.orderNum.trim()) {
      allowed.orderRefs.add(row.orderNum.trim().toLowerCase())
    }
    if (typeof row.id === "string" && row.id.trim()) {
      allowed.orderRefs.add(row.id.trim().toLowerCase())
    }
  }
  const rememberHelp = (value: unknown) => {
    const articles = Array.isArray(value)
      ? value
      : value && typeof value === "object" && "articles" in value
        ? (value as { articles: unknown }).articles
        : []
    if (!Array.isArray(articles)) return
    for (const article of articles) {
      if (article && typeof article === "object" && typeof (article as { slug?: unknown }).slug === "string") {
        allowed.helpSlugs.add((article as { slug: string }).slug)
      }
    }
  }
  const rememberTickets = (value: unknown) => {
    const tickets = Array.isArray(value)
      ? value
      : value && typeof value === "object" && "tickets" in value
        ? (value as { tickets: unknown }).tickets
        : []
    if (!Array.isArray(tickets)) return
    for (const ticket of tickets) {
      if (ticket && typeof ticket === "object" && typeof (ticket as { id?: unknown }).id === "string") {
        allowed.ticketIds.add((ticket as { id: string }).id)
      }
    }
  }

  return {
    lookup_order: tool({
      description:
        "Look up one Reswell order for this customer by order number or id. Returns only that customer's orders.",
      inputSchema: querySchema,
      execute: async ({ query }) => {
        const result = await lookups.lookupOrder(query)
        rememberOrder(result)
        return result
      },
    }),
    lookup_tracking: tool({
      description:
        "Return stored tracking for this customer's order. Never invent a tracking number.",
      inputSchema: querySchema,
      execute: async ({ query }) => {
        const result = await lookups.lookupTracking(query)
        rememberOrder(result)
        return result
      },
    }),
    refund_eligibility: tool({
      description:
        "Staff-only refund facts for this customer's order. Do not promise the customer a refund from this.",
      inputSchema: querySchema,
      execute: async ({ query }) => {
        const result = await lookups.refundEligibility(query)
        rememberOrder(result)
        return result
      },
    }),
    help_article: tool({
      description: "Retrieve current Reswell help-center articles by slug or question.",
      inputSchema: querySchema,
      execute: async ({ query }) => {
        const result = await lookups.helpArticle(query)
        rememberHelp(result)
        return result
      },
    }),
    prior_tickets: tool({
      description: "List this customer's other support tickets (same account or email).",
      inputSchema: z.object({
        query: z.string().trim().max(160).optional(),
      }),
      execute: async ({ query }) => {
        const result = await lookups.priorTickets(query)
        rememberTickets(result)
        return result
      },
    }),
  }
}

function allowedFromPack(pack: CsAgentContextPack) {
  const helpSlugs = new Set(pack.help.map((article) => article.slug))
  const orderRefs = new Set<string>()
  if (pack.order?.orderNum) orderRefs.add(pack.order.orderNum.trim().toLowerCase())
  if (pack.order?.id) orderRefs.add(pack.order.id.toLowerCase())
  const ticketIds = new Set(pack.priorTickets.map((ticket) => ticket.id))
  return { helpSlugs, orderRefs, ticketIds }
}

export async function generateCsAgentDraft(args: {
  model: string
  pack: CsAgentContextPack
  lookups: CsAgentToolLookups
  rootPrompt?: string | null
}): Promise<CsAgentDraftOutput> {
  const allowed = allowedFromPack(args.pack)
  const { output } = await generateText({
    model: args.model,
    tools: createCsAgentTools(args.lookups, allowed),
    stopWhen: isStepCount(CS_AGENT_MAX_STEPS),
    abortSignal: AbortSignal.timeout(CS_AGENT_GENERATE_TIMEOUT_MS),
    output: Output.object({ schema: csAgentLlmSchema }),
    system: csAgentSystemPrompt(args.pack.greetingName, args.rootPrompt),
    prompt: formatCsAgentContextPack(args.pack),
    temperature: 0.3,
    providerOptions: {
      gateway: {
        tags: gatewayTagsForFeature("support_reply_draft"),
      },
    },
  })

  if (!output?.reply.trim()) {
    throw new Error("CS agent returned an empty reply.")
  }

  const cited = filterCsAgentCitations(output, {
    helpSlugs: [...allowed.helpSlugs],
    orderRefs: [...allowed.orderRefs],
    ticketIds: [...allowed.ticketIds],
  })

  return {
    reply: output.reply.trim(),
    reason:
      output.reason.trim() ||
      defaultCsAgentReason({
        origin: "llm",
        hasOrder: Boolean(args.pack.order),
        hasTickets: args.pack.priorTickets.length > 0,
        helpTitles: args.pack.help.map((article) => article.title),
      }),
    citedHelpSlugs:
      cited.citedHelpSlugs.length > 0
        ? cited.citedHelpSlugs
        : args.pack.help.map((article) => article.slug).slice(0, 3),
    citedOrderRefs: cited.citedOrderRefs,
    citedTicketIds: cited.citedTicketIds,
    needsHumanReview: output.needs_human_review,
  }
}
