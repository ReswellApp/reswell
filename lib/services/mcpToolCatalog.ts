import { getMcpShopToolUiMeta } from "@/lib/mcp-widgets/resources"
import { principalHasScope } from "@/lib/services/mcpAuth"
import type { McpAccessPrincipal, McpToolDefinition } from "@/lib/types/mcp"

export const MCP_INSTRUCTIONS = [
  "You are helping a shopper buy used and new surfboards on Reswell.",
  "Prefer browse_listings when the buyer wants to visually pick boards — it opens an interactive Reswell shop widget in hosts that support MCP Apps (Claude, ChatGPT).",
  "Listing photos are absolute URLs in image_url and image_urls. Show those images instead of opening the HTML listing page.",
  "Search listings, edit the cart, and start checkout only after the buyer agrees.",
  "prepare_purchase does not charge a card. Hand the buyer each checkout_url exactly as returned — do not paraphrase, shorten, or invent query parameters.",
  "The buyer identity comes from their signed-in Reswell connection. Never invent a buyer id.",
  "Tools you were not granted scopes for will not appear in tools/list.",
].join(" ")

export const PUBLIC_MCP_TOOL_NAMES = [
  "browse_listings",
  "search_listings",
  "get_listing",
  "get_pricing",
] as const

export const PUBLIC_MCP_INSTRUCTIONS = [
  "You are looking up surfboards and surf gear on Reswell.",
  "Prefer browse_listings or search_listings. Hosts that support MCP Apps open a board picker with photos.",
  "Photos are absolute URLs in image_url (search) and image_urls (one listing). Show those images to the user.",
  "Do not fetch HTML pages such as /l/, /search, /boards, or /sold to collect listings or photos.",
  "This server is read-only. Cart and checkout use the signed-in MCP at /api/mcp.",
].join(" ")

export const MCP_ALL_TOOLS: McpToolDefinition[] = [
  {
    name: "browse_listings",
    title: "Browse boards",
    description:
      "Open the interactive Reswell board picker with live marketplace results. Use this when the buyer wants to shop visually inside the chat. Falls back to structured listing data on hosts without UI.",
    requiredScope: "search",
    ui: true,
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search text, e.g. Channel Islands Twin Pin under $800",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Max boards to show (default 8)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "search_listings",
    title: "Search listings",
    description:
      "Find surfboard titles, live marketplace listings, or catalog models on Reswell. Use query for free text (brand, model, length, price cues). Listing results include image_url and open the shop widget when the host supports MCP Apps. Show those photos. Do not fetch the HTML listing page.",
    requiredScope: "search",
    ui: true,
    annotations: { readOnlyHint: true, openWorldHint: false },
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
    description:
      "Load one listing by id or slug, including price, condition, seller, and image_urls gallery photos. Show image_urls. Do not fetch the HTML listing page.",
    requiredScope: "search",
    annotations: { readOnlyHint: true, openWorldHint: false },
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
    annotations: { readOnlyHint: true, openWorldHint: false },
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
    description: "Read the boards in the signed-in buyer's Reswell cart and their listing prices. Opens the cart panel in the shop widget when supported.",
    requiredScope: "cart:read",
    ui: true,
    annotations: { readOnlyHint: true, openWorldHint: false },
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
      "Add one or more listings to the signed-in buyer's cart. Only changes that buyer's cart. Updates the shop widget when open.",
    requiredScope: "cart:write",
    ui: true,
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
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
    description: "Remove listings from the signed-in buyer's cart. Updates the shop widget when open.",
    requiredScope: "cart:write",
    ui: true,
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
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
      "Create checkout link(s) for the buyer's cart after they explicitly agree to check out. Requires buyer_confirmed: true. Does not charge a card — the buyer pays on Reswell. Return checkout_url values to the buyer unchanged. Opens checkout actions in the shop widget when supported.",
    requiredScope: "checkout",
    ui: true,
    annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
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

export function listPublicMcpTools(): Array<{
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: McpToolDefinition["annotations"]
  _meta?: Record<string, unknown>
}> {
  const names = new Set<string>(PUBLIC_MCP_TOOL_NAMES)
  const uiMeta = getMcpShopToolUiMeta()
  return MCP_ALL_TOOLS.filter((tool) => names.has(tool.name)).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
    ...(tool.ui ? { _meta: uiMeta } : {}),
  }))
}

export function listMcpToolsForPrincipal(principal: McpAccessPrincipal): Array<{
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: McpToolDefinition["annotations"]
  _meta?: Record<string, unknown>
}> {
  const uiMeta = getMcpShopToolUiMeta()
  return MCP_ALL_TOOLS.filter((tool) => principalHasScope(principal, tool.requiredScope)).map(
    (tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
      ...(tool.ui ? { _meta: uiMeta } : {}),
    }),
  )
}

export function findMcpToolDefinition(name: string): McpToolDefinition | undefined {
  return MCP_ALL_TOOLS.find((tool) => tool.name === name)
}
