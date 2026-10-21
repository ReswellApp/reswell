import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getPublicResearchOpenApiSpec, PUBLIC_RESEARCH_OPENAPI_VERSION } from "./public-research-spec.ts"

describe("public research OpenAPI spec", () => {
  const spec = getPublicResearchOpenApiSpec("https://www.reswell.app")

  it("is OpenAPI 3.1 with required info and a production server", () => {
    assert.equal(spec.openapi, "3.1.0")
    assert.equal(spec.info.title, "Reswell public research API")
    assert.equal(spec.info.version, PUBLIC_RESEARCH_OPENAPI_VERSION)
    assert.equal(spec.servers[0]?.url, "https://www.reswell.app")
  })

  it("documents every public research endpoint", () => {
    const paths = Object.keys(spec.paths)
    assert.deepEqual(paths.sort(), [
      "/api/public",
      "/api/public/listings/{id}",
      "/api/public/pricing",
      "/api/public/search",
    ])
    for (const path of paths) {
      const item = spec.paths[path] as { get?: { operationId?: string } }
      assert.ok(item.get?.operationId, `${path} is missing GET operationId`)
    }
  })

  it("declares a reusable 429 response", () => {
    assert.ok(spec.components.responses.RateLimited)
    assert.ok(spec.components.schemas.RateLimitedBody)
    assert.ok(spec.components.schemas.Catalog)
  })
})
