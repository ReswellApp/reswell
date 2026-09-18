import { generateText, isStepCount, Output, tool } from "ai"
import { z } from "zod"
import { gatewayTagsForFeature } from "@/lib/llm/app-models"
import {
  CS_AGENT_GENERATE_TIMEOUT_MS,
  CS_AGENT_LIVE_CHAT_MAX_STEPS,
  CS_AGENT_LIVE_CHAT_TIMEOUT_MS,
  CS_AGENT_MAX_STEPS,
  csAgentLiveChatSystemPrompt,
  csAgentSystemPrompt,
  defaultCsAgentReason,
  filterCsAgentCitations,
  formatCsAgentContextPack,
  type CsAgentContextPack,
  type CsAgentDraftOutput,
} from "@/lib/llm/cs-agent"
import { csAgentLlmSchema } from "@/lib/validations/supportReplyDraft"

export type CsAgentToolLookups = {
  confirmAuth: () => Promise<unknown>
  listCustomerOrders: (query?: string) => Promise<unknown>
  lookupOrder: (query: string) => Promise<unknown>
  lookupTracking: (query: string) => Promise<unknown>
  refundEligibility: (query: string) => Promise<unknown>
  helpArticle: (query: string) => Promise<unknown>
  priorTickets: (query?: string) => Promise<unknown>
  shippingLabelStatus: (query: string) => Promise<unknown>
  proposeShippingAction?: (input: {
    type: "void_shipping_label" | "replace_shipping_label"
    orderQuery: string
    lengthIn?: number
    widthIn?: number
    heightIn?: number
    weightLb?: number
    note?: string
  }) => Promise<unknown>
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
    confirm_auth: tool({
      description:
        "Confirm whether this visitor is signed in and may access their own orders. Call before sharing order facts.",
      inputSchema: z.object({}),
      execute: async () => lookups.confirmAuth(),
    }),
    list_customer_orders: tool({
      description:
        "List this signed-in customer's recent purchases (buyer) and sales (seller). Read-only. Never for other users.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .max(40)
          .optional()
          .describe("Optional filter: purchases, sales, or all"),
      }),
      execute: async ({ query }) => {
        const result = await lookups.listCustomerOrders(query)
        if (result && typeof result === "object" && "orders" in result) {
          const orders = (result as { orders: unknown }).orders
          if (Array.isArray(orders)) {
            for (const order of orders) rememberOrder(order)
          }
        }
        return result
      },
    }),
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
      description:
        "Retrieve current Reswell help-center articles (/help) by slug or question — Purchase Protection, buying, selling, shipping, accounts.",
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
    shipping_label_status: tool({
      description:
        "Read-only shipping label / tracking status for this customer's order. Never invent tracking.",
      inputSchema: querySchema,
      execute: async ({ query }) => {
        const result = await lookups.shippingLabelStatus(query)
        rememberOrder(result)
        return result
      },
    }),
    ...(lookups.proposeShippingAction
      ? {
          propose_shipping_action: tool({
            description:
              "Propose voiding or replacing a shipping label. Does NOT execute — creates a confirm card. Never claim the label already changed. For replace, include parcel inches and weightLb.",
            inputSchema: z.object({
              type: z.enum(["void_shipping_label", "replace_shipping_label"]),
              order_query: z.string().trim().min(1).max(160),
              length_in: z.number().positive().max(120).optional(),
              width_in: z.number().positive().max(120).optional(),
              height_in: z.number().positive().max(120).optional(),
              weight_lb: z.number().positive().max(150).optional(),
              note: z.string().trim().max(500).optional(),
            }),
            execute: async (input) => {
              const result = await lookups.proposeShippingAction!({
                type: input.type,
                orderQuery: input.order_query,
                lengthIn: input.length_in,
                widthIn: input.width_in,
                heightIn: input.height_in,
                weightLb: input.weight_lb,
                note: input.note,
              })
              rememberOrder(result)
              return result
            },
          }),
        }
      : {}),
  }
}

function allowedFromPack(pack: CsAgentContextPack) {
  const helpSlugs = new Set(pack.help.map((article) => article.slug))
  const orderRefs = new Set<string>()
  if (pack.order?.orderNum) orderRefs.add(pack.order.orderNum.trim().toLowerCase())
  if (pack.order?.id) orderRefs.add(pack.order.id.toLowerCase())
  for (const order of pack.accountSnapshot?.orders ?? []) {
    if (order.orderNum) orderRefs.add(order.orderNum.trim().toLowerCase())
    if (order.id) orderRefs.add(order.id.toLowerCase())
  }
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
  const isLiveChat = args.pack.sourceChannel === "live_chat"
  const system = isLiveChat
    ? csAgentLiveChatSystemPrompt(
        args.pack.greetingName,
        args.pack.rewriteInstruction ?? args.rootPrompt,
      )
    : csAgentSystemPrompt(args.pack.greetingName, args.rootPrompt)

  const { output } = await generateText({
    model: args.model,
    tools: createCsAgentTools(args.lookups, allowed),
    stopWhen: isStepCount(isLiveChat ? CS_AGENT_LIVE_CHAT_MAX_STEPS : CS_AGENT_MAX_STEPS),
    abortSignal: AbortSignal.timeout(
      isLiveChat ? CS_AGENT_LIVE_CHAT_TIMEOUT_MS : CS_AGENT_GENERATE_TIMEOUT_MS,
    ),
    output: Output.object({ schema: csAgentLlmSchema }),
    system,
    prompt: formatCsAgentContextPack(args.pack),
    temperature: isLiveChat ? 0.2 : 0.3,
    maxOutputTokens: isLiveChat ? 1400 : undefined,
    providerOptions: {
      gateway: {
        tags: gatewayTagsForFeature(isLiveChat ? "live_chat_cs" : "support_reply_draft"),
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
    closeTicket: isLiveChat && output.close_ticket === true,
  }
}
