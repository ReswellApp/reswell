import {
  getPublicListingService,
  getPublicPricingService,
  searchPublicResearchService,
} from "@/lib/services/publicResearchApi"
import {
  addMcpCartItemsService,
  getMcpCartService,
  prepareMcpPurchaseService,
  removeMcpCartItemsService,
} from "@/lib/services/mcpCart"
import { principalHasScope } from "@/lib/services/mcpAuth"
import { findMcpToolDefinition } from "@/lib/services/mcpToolCatalog"
import type { McpAccessPrincipal } from "@/lib/types/mcp"
import {
  mcpGetListingArgsSchema,
  mcpGetPricingArgsSchema,
  mcpListingIdsArgsSchema,
  mcpPreparePurchaseArgsSchema,
  mcpSearchListingsArgsSchema,
} from "@/lib/validations/mcp"

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    isError,
  }
}

export async function callMcpToolService(
  principal: McpAccessPrincipal,
  name: string,
  args: unknown,
): Promise<{ content: { type: "text"; text: string }[]; isError: boolean }> {
  const tool = findMcpToolDefinition(name)
  if (!tool) {
    return textResult(`Unknown tool: ${name}`, true)
  }
  if (!principalHasScope(principal, tool.requiredScope)) {
    return textResult(`Missing scope ${tool.requiredScope} for tool ${name}`, true)
  }

  try {
    switch (name) {
      case "search_listings": {
        const parsed = mcpSearchListingsArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await searchPublicResearchService({
          q: parsed.data.query,
          type: parsed.data.type,
          limit: parsed.data.limit,
        })
        if (!result.ok) return textResult(result.error, true)
        return textResult(JSON.stringify(result.data, null, 2))
      }
      case "get_listing": {
        const parsed = mcpGetListingArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await getPublicListingService(parsed.data.listing_id)
        if (!result.ok) return textResult(result.error, true)
        return textResult(JSON.stringify(result.data, null, 2))
      }
      case "get_pricing": {
        const parsed = mcpGetPricingArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await getPublicPricingService(parsed.data)
        if (!result.ok) return textResult(result.error, true)
        return textResult(JSON.stringify(result.data, null, 2))
      }
      case "get_cart": {
        const result = await getMcpCartService(principal.userId)
        if (!result.ok) return textResult(result.error, true)
        return textResult(JSON.stringify(result, null, 2))
      }
      case "add_to_cart": {
        const parsed = mcpListingIdsArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await addMcpCartItemsService(principal.userId, parsed.data.listing_ids)
        if (!result.ok) return textResult(result.error, true)
        const cart = await getMcpCartService(principal.userId)
        return textResult(
          JSON.stringify(
            {
              ...result,
              cart: cart.ok ? cart : undefined,
            },
            null,
            2,
          ),
        )
      }
      case "remove_from_cart": {
        const parsed = mcpListingIdsArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await removeMcpCartItemsService(principal.userId, parsed.data.listing_ids)
        if (!result.ok) return textResult(result.error, true)
        const cart = await getMcpCartService(principal.userId)
        return textResult(
          JSON.stringify(
            {
              ...result,
              cart: cart.ok ? cart : undefined,
            },
            null,
            2,
          ),
        )
      }
      case "prepare_purchase": {
        const parsed = mcpPreparePurchaseArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(
            "prepare_purchase refused: set buyer_confirmed to true only after the buyer agrees to check out. Nothing was charged.",
            true,
          )
        }
        const result = await prepareMcpPurchaseService(
          principal.userId,
          parsed.data.seller_id,
        )
        if (!result.ok) return textResult(result.error, true)
        return textResult(
          JSON.stringify(
            {
              checkout_urls: result.checkout_urls,
              checkout_url: result.checkout_urls[0] ?? null,
              note: result.note,
            },
            null,
            2,
          ),
        )
      }
      default:
        return textResult(`Unknown tool: ${name}`, true)
    }
  } catch (error) {
    console.error("[mcp-tools] call failed", {
      timestamp: new Date().toISOString(),
      userId: principal.userId,
      tool: name,
      message: error instanceof Error ? error.message : String(error),
    })
    return textResult("Tool call failed", true)
  }
}
