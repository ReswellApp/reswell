import { z } from "zod"
import { MCP_SCOPES } from "@/lib/types/mcp"

export const mcpScopeSchema = z.enum(MCP_SCOPES)

export const mcpAuthorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().trim().min(1).max(128),
  redirect_uri: z.string().trim().url().max(2000),
  scope: z.string().trim().min(1).max(500),
  state: z.string().trim().max(500).optional(),
  code_challenge: z.string().trim().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  resource: z.string().trim().url().max(500),
})

export const mcpConsentActionSchema = z.object({
  client_id: z.string().trim().min(1).max(128),
  redirect_uri: z.string().trim().url().max(2000),
  scope: z.string().trim().min(1).max(500),
  state: z.string().trim().max(500).optional(),
  code_challenge: z.string().trim().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  resource: z.string().trim().url().max(500),
  approved_scopes: z.array(mcpScopeSchema).min(1),
  decision: z.enum(["approve", "deny"]),
})

export const mcpRegisterClientSchema = z.object({
  client_name: z.string().trim().min(1).max(120).optional(),
  redirect_uris: z.array(z.string().trim().url().max(2000)).min(1).max(20),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .optional(),
  response_types: z.array(z.literal("code")).optional(),
  token_endpoint_auth_method: z
    .enum(["none", "client_secret_post", "client_secret_basic"])
    .optional(),
})

export const mcpSearchListingsArgsSchema = z.object({
  query: z.string().trim().min(1).max(200),
  type: z.enum(["listings", "models"]).default("listings"),
  limit: z.coerce.number().int().min(1).max(10).default(5),
})

export const mcpGetListingArgsSchema = z.object({
  listing_id: z.string().trim().min(1).max(160),
})

export const mcpGetPricingArgsSchema = z.object({
  brand: z.string().trim().min(1).max(120),
  model: z.string().trim().max(120).optional(),
})

export const mcpListingIdsArgsSchema = z.object({
  listing_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
})

export const mcpPreparePurchaseArgsSchema = z.object({
  buyer_confirmed: z.literal(true),
  seller_id: z.string().trim().uuid().optional(),
})

export type McpAuthorizeQuery = z.infer<typeof mcpAuthorizeQuerySchema>
export type McpConsentActionInput = z.infer<typeof mcpConsentActionSchema>
export type McpRegisterClientInput = z.infer<typeof mcpRegisterClientSchema>
