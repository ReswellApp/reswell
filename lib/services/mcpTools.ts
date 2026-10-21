import { MCP_SHOP_META_KEY } from "@/lib/mcp-widgets/constants"
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
import type { McpAccessPrincipal, McpToolCallResult } from "@/lib/types/mcp"
import {
  mcpBrowseListingsArgsSchema,
  mcpGetListingArgsSchema,
  mcpGetPricingArgsSchema,
  mcpListingIdsArgsSchema,
  mcpPreparePurchaseArgsSchema,
  mcpSearchListingsArgsSchema,
} from "@/lib/validations/mcp"

function textResult(text: string, isError = false): McpToolCallResult {
  return {
    content: [{ type: "text", text }],
    isError,
  }
}

function shopResult(input: {
  message: string
  view: "browse" | "cart" | "checkout"
  query?: string
  listings?: unknown[]
  cart?: unknown
  checkout_urls?: string[]
  checkout_url?: string | null
  note?: string
  isError?: boolean
  extra?: Record<string, unknown>
}): McpToolCallResult {
  const structuredContent: Record<string, unknown> = {
    view: input.view,
    message: input.message,
    ...(input.query != null ? { query: input.query } : {}),
    ...(input.listings ? { listings: input.listings } : {}),
    ...(input.cart ? { cart: input.cart } : {}),
    ...(input.checkout_urls ? { checkout_urls: input.checkout_urls } : {}),
    ...(input.checkout_url !== undefined ? { checkout_url: input.checkout_url } : {}),
    ...(input.note ? { note: input.note } : {}),
    ...input.extra,
  }
  return {
    content: [{ type: "text", text: input.message }],
    structuredContent,
    _meta: { [MCP_SHOP_META_KEY]: structuredContent },
    isError: input.isError,
  }
}

async function loadCartSnapshot(userId: string) {
  const cart = await getMcpCartService(userId)
  if (!cart.ok) return null
  return { items: cart.items, item_count: cart.item_count }
}

export async function callMcpToolService(
  principal: McpAccessPrincipal,
  name: string,
  args: unknown,
): Promise<McpToolCallResult> {
  const tool = findMcpToolDefinition(name)
  if (!tool) {
    return textResult(`Unknown tool: ${name}`, true)
  }
  if (!principalHasScope(principal, tool.requiredScope)) {
    return textResult(`Missing scope ${tool.requiredScope} for tool ${name}`, true)
  }

  try {
    switch (name) {
      case "browse_listings": {
        const parsed = mcpBrowseListingsArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await searchPublicResearchService({
          q: parsed.data.query,
          type: "listings",
          limit: parsed.data.limit,
        })
        if (!result.ok) return textResult(result.error, true)
        const listings = Array.isArray(result.data.results) ? result.data.results : []
        const cart = principalHasScope(principal, "cart:read")
          ? await loadCartSnapshot(principal.userId)
          : null
        return shopResult({
          view: "browse",
          query: parsed.data.query,
          listings,
          cart: cart ?? undefined,
          message: `Opened the Reswell board picker with ${listings.length} listing(s) for “${parsed.data.query}”. The buyer can Add in the widget, or ask you to adjust the cart. prepare_purchase does not charge a card.`,
        })
      }
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
        if (parsed.data.type === "listings") {
          const listings = Array.isArray(result.data.results) ? result.data.results : []
          const cart = principalHasScope(principal, "cart:read")
            ? await loadCartSnapshot(principal.userId)
            : null
          return shopResult({
            view: "browse",
            query: parsed.data.query,
            listings,
            cart: cart ?? undefined,
            message: JSON.stringify(result.data, null, 2),
            extra: { type: "listings", results: listings },
          })
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
          structuredContent: result.data as unknown as Record<string, unknown>,
        }
      }
      case "get_listing": {
        const parsed = mcpGetListingArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await getPublicListingService(parsed.data.listing_id)
        if (!result.ok) return textResult(result.error, true)
        return {
          content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
          structuredContent: result.data as unknown as Record<string, unknown>,
        }
      }
      case "get_pricing": {
        const parsed = mcpGetPricingArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await getPublicPricingService(parsed.data)
        if (!result.ok) return textResult(result.error, true)
        return {
          content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
          structuredContent: result.data as unknown as Record<string, unknown>,
        }
      }
      case "get_cart": {
        const result = await getMcpCartService(principal.userId)
        if (!result.ok) return textResult(result.error, true)
        return shopResult({
          view: "cart",
          cart: { items: result.items, item_count: result.item_count },
          message: `Cart has ${result.item_count} item(s).`,
        })
      }
      case "add_to_cart": {
        const parsed = mcpListingIdsArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await addMcpCartItemsService(principal.userId, parsed.data.listing_ids)
        if (!result.ok) return textResult(result.error, true)
        const cart = await loadCartSnapshot(principal.userId)
        return shopResult({
          view: "cart",
          cart: cart ?? undefined,
          message:
            result.added.length > 0
              ? `Added ${result.added.length} listing(s) to cart.`
              : "No listings were added.",
          extra: { added: result.added, errors: result.errors },
          isError: result.added.length === 0 && result.errors.length > 0,
        })
      }
      case "remove_from_cart": {
        const parsed = mcpListingIdsArgsSchema.safeParse(args ?? {})
        if (!parsed.success) {
          return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        }
        const result = await removeMcpCartItemsService(principal.userId, parsed.data.listing_ids)
        if (!result.ok) return textResult(result.error, true)
        const cart = await loadCartSnapshot(principal.userId)
        return shopResult({
          view: "cart",
          cart: cart ?? undefined,
          message: `Removed ${result.removed.length} listing(s) from cart.`,
          extra: { removed: result.removed },
        })
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
        const cart = await loadCartSnapshot(principal.userId)
        return shopResult({
          view: "checkout",
          cart: cart ?? undefined,
          checkout_urls: result.checkout_urls,
          checkout_url: result.checkout_urls[0] ?? null,
          note: result.note,
          message:
            `Checkout ready. Hand each checkout_url to the buyer unchanged:\n` +
            result.checkout_urls.join("\n"),
        })
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
