import { MCP_SCOPES } from "@/lib/types/mcp"
import {
  mcpAuthorizationServerIssuer,
  mcpProtectedResourceMetadataUrl,
  mcpResourceUrl,
} from "@/lib/services/mcpConfig"
import { absoluteUrl } from "@/lib/site-metadata"

export function buildMcpProtectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [mcpAuthorizationServerIssuer()],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ["header"],
    resource_documentation: absoluteUrl("/oauth/connections"),
  }
}

export function buildMcpAuthorizationServerMetadata() {
  const issuer = mcpAuthorizationServerIssuer()
  return {
    issuer,
    authorization_endpoint: absoluteUrl("/oauth/authorize"),
    token_endpoint: absoluteUrl("/api/oauth/token"),
    registration_endpoint: absoluteUrl("/api/oauth/register"),
    revocation_endpoint: absoluteUrl("/api/oauth/revoke"),
    scopes_supported: [...MCP_SCOPES],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    resource_indicators_supported: true,
    service_documentation: absoluteUrl("/oauth/connections"),
    protected_resource_metadata: mcpProtectedResourceMetadataUrl(),
  }
}
