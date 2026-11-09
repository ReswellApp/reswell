import assert from "node:assert/strict"
import test from "node:test"
import {
  isMcpRedirectUriAllowed,
  mcpResourceMatches,
  parseMcpScopes,
  parseStaffMcpScopes,
  formatMcpScopes,
  resolveMcpResourceKind,
} from "@/lib/services/mcpConfig"
import { mcpHashSecret, mcpPkceChallengeFromVerifier, mcpSafeEqualHex } from "@/lib/services/mcpCrypto"

test("parseMcpScopes keeps only supported scopes in stable order", () => {
  assert.deepEqual(parseMcpScopes("checkout search cart:write bogus"), [
    "search",
    "cart:write",
    "checkout",
  ])
  assert.deepEqual(parseMcpScopes("blog:write catalog:read bogus search"), [
    "search",
    "catalog:read",
    "blog:write",
  ])
  assert.equal(formatMcpScopes(["search", "checkout"]), "search checkout")
})

test("staff and shopper resource URLs do not match each other", () => {
  assert.equal(
    mcpResourceMatches(
      "https://www.reswell.app/api/mcp",
      "https://www.reswell.app/api/staff-mcp",
    ),
    false,
  )
})

test("parseStaffMcpScopes drops shopper scopes", () => {
  assert.deepEqual(parseStaffMcpScopes("search catalog:write blog:read checkout"), [
    "catalog:write",
    "blog:read",
  ])
})

test("resolveMcpResourceKind distinguishes shopper and staff paths", () => {
  assert.equal(
    resolveMcpResourceKind("https://www.reswell.app/api/mcp"),
    "shopper",
  )
  assert.equal(
    resolveMcpResourceKind("https://www.reswell.app/api/staff-mcp"),
    "staff",
  )
  assert.equal(resolveMcpResourceKind("https://www.reswell.app/api/other"), null)
})

test("redirect URIs allow https and localhost http only", () => {
  assert.equal(isMcpRedirectUriAllowed("https://claude.ai/callback"), true)
  assert.equal(isMcpRedirectUriAllowed("http://localhost:3000/cb"), true)
  assert.equal(isMcpRedirectUriAllowed("http://evil.example/cb"), false)
  assert.equal(isMcpRedirectUriAllowed("https://x.example/cb#frag"), false)
})

test("mcpResourceMatches normalizes trailing slashes and host case", () => {
  assert.equal(
    mcpResourceMatches(
      "https://WWW.reswell.app/api/mcp/",
      "https://www.reswell.app/api/mcp",
    ),
    true,
  )
  assert.equal(
    mcpResourceMatches(
      "https://www.reswell.app/api/mcp",
      "https://www.reswell.app/api/other",
    ),
    false,
  )
})

test("PKCE S256 challenge matches known verifier", () => {
  // RFC 7636 appendix B
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  assert.equal(
    mcpPkceChallengeFromVerifier(verifier),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  )
})

test("secret hashing is stable and compared in constant time", () => {
  const hash = mcpHashSecret("rw_at_test")
  assert.equal(hash.length, 64)
  assert.equal(mcpSafeEqualHex(hash, mcpHashSecret("rw_at_test")), true)
  assert.equal(mcpSafeEqualHex(hash, mcpHashSecret("other")), false)
})
