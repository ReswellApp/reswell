import { principalHasScope } from "@/lib/services/mcpAuth"
import type { McpAccessPrincipal, McpToolDefinition } from "@/lib/types/mcp"

export const MCP_INSTRUCTIONS = [
  "You are helping a shopper buy used and new surfboards on Reswell.",
  "Search listings, edit the cart, and start checkout only after the buyer agrees.",
  "prepare_purchase does not charge a card. Hand the buyer each checkout_url exactly as returned — do not paraphrase, shorten, or invent query parameters.",
  "The buyer identity comes from their signed-in Reswell connection. Never invent a buyer id.",
  "Tools you were not granted scopes for will not appear in tools/list.",
].join(" ")

export const MCP_ALL_TOOLS: McpToolDefinition[] = [
  {
    name: "search_listings",
    title: "Search listings",
    description:
      "Find surfboard titles, live marketplace listings, or catalog models on Reswell. Use query for free text (brand, model, length, price cues).",
    requiredScope: "search",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search text, e.g. Channel Islands Twin Pin under $800",
        },
        type: {
          type: "string",
          enum: ["listings", "models"],
          description: "listings (default) returns buyable boards; models returns catalog models",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Max results (default 5)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_listing",
    title: "Get listing",
    description: "Load one listing by id or slug, including price, condition, and seller.",
    requiredScope: "search",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: {
          type: "string",
          description: "Listing UUID or slug",
        },
      },
      required: ["listing_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_pricing",
    title: "Get pricing comps",
    description:
      "Used-board asking prices and recent sold comps for a brand (and optional model).",
    requiredScope: "search",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string", description: "Brand name or slug" },
        model: { type: "string", description: "Optional model name or slug" },
      },
      required: ["brand"],
      additionalProperties: false,
    },
  },
  {
    name: "get_cart",
    title: "Get cart",
    description: "Read the boards in the signed-in buyer's Reswell cart and their listing prices.",
    requiredScope: "cart:read",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "add_to_cart",
    title: "Add to cart",
    description:
      "Add one or more listings to the signed-in buyer's cart. Only changes that buyer's cart.",
    requiredScope: "cart:write",
    inputSchema: {
      type: "object",
      properties: {
        listing_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 20,
          description: "Listing UUIDs to add",
        },
      },
      required: ["listing_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_from_cart",
    title: "Remove from cart",
    description: "Remove listings from the signed-in buyer's cart.",
    requiredScope: "cart:write",
    inputSchema: {
      type: "object",
      properties: {
        listing_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 20,
          description: "Listing UUIDs to remove",
        },
      },
      required: ["listing_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "prepare_purchase",
    title: "Start checkout",
    description:
      "Create checkout link(s) for the buyer's cart after they explicitly agree to check out. Requires buyer_confirmed: true. Does not charge a card — the buyer pays on Reswell. Return checkout_url values to the buyer unchanged.",
    requiredScope: "checkout",
    inputSchema: {
      type: "object",
      properties: {
        buyer_confirmed: {
          type: "boolean",
          const: true,
          description: "Must be true. Call only after the buyer agrees to start checkout.",
        },
        seller_id: {
          type: "string",
          description: "Optional seller UUID when the cart has multiple sellers",
        },
      },
      required: ["buyer_confirmed"],
      additionalProperties: false,
    },
  },
]

export function listMcpToolsForPrincipal(principal: McpAccessPrincipal): Array<{
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
}> {
  return MCP_ALL_TOOLS.filter((tool) => principalHasScope(principal, tool.requiredScope)).map(
    ({ name, title, description, inputSchema }) => ({
      name,
      title,
      description,
      inputSchema,
    }),
  )
}

export function findMcpToolDefinition(name: string): McpToolDefinition | undefined {
  return MCP_ALL_TOOLS.find((tool) => tool.name === name)
}
