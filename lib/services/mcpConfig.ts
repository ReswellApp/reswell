import { absoluteUrl } from "@/lib/site-metadata"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import {
  MCP_SCOPES,
  MCP_SHOPPER_SCOPES,
  MCP_STAFF_SCOPES,
  type McpResourceKind,
  type McpScope,
  type McpShopperScope,
  type McpStaffScope,
} from "@/lib/types/mcp"

export const MCP_PROTOCOL_VERSION = "2025-06-18"
export const MCP_ACCESS_TOKEN_TTL_SECONDS = 60 * 60
export const MCP_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90
export const MCP_AUTH_CODE_TTL_SECONDS = 10 * 60

export function isMcpEnabled(): boolean {
  const raw = process.env.MCP_ENABLED?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "off") return false
  return true
}

export function mcpResourceUrl(): string {
  return absoluteUrl("/api/mcp")
}

export function staffMcpResourceUrl(): string {
  return absoluteUrl("/api/staff-mcp")
}

export function mcpAuthorizationServerIssuer(): string {
  return publicSiteOrigin()
}

export function mcpProtectedResourceMetadataUrl(): string {
  return absoluteUrl("/.well-known/oauth-protected-resource")
}

export function staffMcpProtectedResourceMetadataUrl(): string {
  return absoluteUrl("/.well-known/oauth-protected-resource/api/staff-mcp")
}

export function mcpAuthorizationServerMetadataUrl(): string {
  return absoluteUrl("/.well-known/oauth-authorization-server")
}

export function mcpWwwAuthenticateHeader(
  error?: string,
  description?: string,
  options?: { resourceMetadataUrl?: string; realm?: string },
): string {
  const parts = [
    `Bearer realm="${options?.realm ?? "mcp"}"`,
    `resource_metadata="${options?.resourceMetadataUrl ?? mcpProtectedResourceMetadataUrl()}"`,
  ]
  if (error) parts.push(`error="${error}"`)
  if (description) {
    parts.push(`error_description="${description.replace(/"/g, "'")}"`)
  }
  return parts.join(", ")
}

export function staffMcpWwwAuthenticateHeader(error?: string, description?: string): string {
  return mcpWwwAuthenticateHeader(error, description, {
    realm: "staff-mcp",
    resourceMetadataUrl: staffMcpProtectedResourceMetadataUrl(),
  })
}

export function parseMcpScopes(raw: string | undefined | null): McpScope[] {
  if (!raw?.trim()) return []
  const wanted = new Set(
    raw
      .split(/[\s+]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  return MCP_SCOPES.filter((scope) => wanted.has(scope))
}

export function parseShopperMcpScopes(raw: string | undefined | null): McpShopperScope[] {
  const wanted = new Set(parseMcpScopes(raw))
  return MCP_SHOPPER_SCOPES.filter((scope) => wanted.has(scope))
}

export function parseStaffMcpScopes(raw: string | undefined | null): McpStaffScope[] {
  const wanted = new Set(parseMcpScopes(raw))
  return MCP_STAFF_SCOPES.filter((scope) => wanted.has(scope))
}

export function formatMcpScopes(scopes: McpScope[]): string {
  return scopes.join(" ")
}

export function resolveMcpResourceKind(resource: string): McpResourceKind | null {
  if (mcpResourceMatches(resource, mcpResourceUrl())) return "shopper"
  if (mcpResourceMatches(resource, staffMcpResourceUrl())) return "staff"
  return null
}

/** When set, only these emails may approve MCP connections (soft launch). */
export function mcpAllowlistEmails(): Set<string> | null {
  const raw = process.env.MCP_OAUTH_ALLOWLIST_EMAILS?.trim()
  if (!raw) return null
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return emails.length > 0 ? new Set(emails) : null
}

export function isMcpRedirectUriAllowed(uri: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch {
    return false
  }
  if (parsed.hash) return false
  const host = parsed.hostname.toLowerCase()
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  }
  return parsed.protocol === "https:"
}

export function mcpResourceMatches(requested: string, expected: string): boolean {
  const normalize = (value: string) => {
    try {
      const u = new URL(value)
      u.hash = ""
      let path = u.pathname
      if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1)
      return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${path}`
    } catch {
      return value.trim().replace(/\/+$/, "")
    }
  }
  return normalize(requested) === normalize(expected)
}
