export const PUBLIC_RESEARCH_OPENAPI_VERSION = "1.0.0"

export type OpenApiDocument = {
  openapi: "3.1.0"
  info: {
    title: string
    summary: string
    description: string
    version: string
    contact: { name: string; url: string }
  }
  servers: Array<{ url: string; description: string }>
  tags: Array<{ name: string; description: string }>
  paths: Record<string, unknown>
  components: {
    schemas: Record<string, unknown>
    responses: Record<string, unknown>
  }
}

const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: { type: "string" },
    details: { type: "object", additionalProperties: true },
  },
}

const rateLimitSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message", "tier", "limit_per_minute", "retry_after"],
  properties: {
    error: { type: "string", examples: ["Too many requests"] },
    message: { type: "string" },
    tier: { type: "string", enum: ["free", "registered"] },
    limit_per_minute: { type: "integer" },
    retry_after: { type: "integer" },
    upgrade: {
      type: "object",
      additionalProperties: false,
      required: ["limit_per_minute", "how", "docs"],
      properties: {
        limit_per_minute: { type: "integer" },
        how: { type: "string" },
        docs: { type: "string", format: "uri" },
      },
    },
  },
}

const marketStatsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["min_usd", "max_usd", "avg_usd", "median_usd", "count"],
  properties: {
    min_usd: { type: ["number", "null"] },
    max_usd: { type: ["number", "null"] },
    avg_usd: { type: ["number", "null"] },
    median_usd: { type: ["number", "null"] },
    count: { type: "integer" },
  },
}

export function getPublicResearchOpenApiSpec(origin: string): OpenApiDocument {
  const base = origin.replace(/\/$/, "")

  return {
    openapi: "3.1.0",
    info: {
      title: "Reswell public research API",
      summary: "Search used surfboard listings, catalog models, and sold comps.",
      description: [
        "JSON API for listings, used-board comps, and catalog search.",
        "No API key required. CORS is open (`Access-Control-Allow-Origin: *`).",
        "Success responses use `{ \"success\": true, \"data\": { ... } }`.",
        `Human docs: ${base}/public-api. Agent guide: ${base}/llms.txt.`,
      ].join(" "),
      version: PUBLIC_RESEARCH_OPENAPI_VERSION,
      contact: {
        name: "Reswell",
        url: `${base}/help`,
      },
    },
    servers: [
      {
        url: base,
        description: "Reswell production",
      },
    ],
    tags: [
      { name: "Catalog", description: "Machine-readable endpoint index" },
      { name: "Search", description: "Find a catalog model or listing" },
      { name: "Pricing", description: "Asking and sold comps for a brand / model" },
      { name: "Listings", description: "A specific used board or gear listing" },
    ],
    paths: {
      "/api/public": {
        get: {
          operationId: "getPublicApiCatalog",
          tags: ["Catalog"],
          summary: "List public research endpoints",
          description: "Machine-readable index of the public research API.",
          responses: {
            "200": {
              description: "Endpoint catalog",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CatalogResponse" },
                },
              },
            },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/api/public/search": {
        get: {
          operationId: "searchPublicResearch",
          tags: ["Search"],
          summary: "Search catalog models or listings",
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 200 },
              description: "Search query (brand, model, or listing text).",
            },
            {
              name: "type",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["models", "listings"], default: "models" },
              description: "`models` is preferred for research. `listings` returns live copies.",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 10, default: 5 },
              description: "Page 1 only. Maximum 10 results.",
            },
          ],
          responses: {
            "200": {
              description: "Search results",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SearchResponse" },
                },
              },
            },
            "400": {
              description: "Invalid query",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/api/public/pricing": {
        get: {
          operationId: "getPublicPricing",
          tags: ["Pricing"],
          summary: "Used-board asking and sold comps",
          parameters: [
            {
              name: "brand",
              in: "query",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 120 },
              description: "Brand slug or name (for example `channel-islands`).",
            },
            {
              name: "model",
              in: "query",
              required: false,
              schema: { type: "string", maxLength: 120 },
              description: "Model name or slug. Omit for brand-wide comps.",
            },
          ],
          responses: {
            "200": {
              description: "Asking and sold stats for the last 365 days",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PricingResponse" },
                },
              },
            },
            "400": {
              description: "Invalid query",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Brand not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/api/public/listings/{id}": {
        get: {
          operationId: "getPublicListing",
          tags: ["Listings"],
          summary: "Listing detail by id or slug",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 160 },
              description: "Listing UUID or URL slug.",
            },
          ],
          responses: {
            "200": {
              description: "Listing detail",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ListingResponse" },
                },
              },
            },
            "400": {
              description: "Invalid listing id",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Listing not found or not publicly visible",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
    },
    components: {
      responses: {
        RateLimited: {
          description: "Free tier is 10 requests / minute per IP. Registered is 30 / minute.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RateLimitedBody" },
            },
          },
        },
      },
      schemas: {
        ErrorResponse: errorSchema,
        RateLimitedBody: rateLimitSchema,
        CatalogResponse: {
          type: "object",
          additionalProperties: false,
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", const: true },
            data: { $ref: "#/components/schemas/Catalog" },
          },
        },
        Catalog: {
          type: "object",
          additionalProperties: false,
          required: ["name", "docs", "llms_txt", "openapi_json", "endpoints"],
          properties: {
            name: { type: "string" },
            docs: { type: "string", format: "uri" },
            llms_txt: { type: "string", format: "uri" },
            openapi_json: { type: "string", format: "uri" },
            endpoints: {
              type: "array",
              items: { $ref: "#/components/schemas/CatalogEndpoint" },
            },
          },
        },
        CatalogEndpoint: {
          type: "object",
          additionalProperties: false,
          required: ["method", "path", "summary"],
          properties: {
            method: { type: "string", const: "GET" },
            path: { type: "string" },
            summary: { type: "string" },
          },
        },
        SearchResponse: {
          type: "object",
          additionalProperties: false,
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", const: true },
            data: { $ref: "#/components/schemas/SearchResult" },
          },
        },
        SearchResult: {
          type: "object",
          additionalProperties: false,
          required: ["type", "results"],
          properties: {
            type: { type: "string", enum: ["models", "listings"] },
            results: {
              type: "array",
              items: {
                oneOf: [
                  { $ref: "#/components/schemas/ModelCard" },
                  { $ref: "#/components/schemas/ListingCard" },
                ],
              },
            },
          },
        },
        ModelCard: {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "brand", "brand_slug", "urls"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            brand: { type: "string" },
            brand_slug: { type: "string" },
            urls: {
              type: "object",
              additionalProperties: false,
              required: ["brand_html", "search_html", "pricing_api"],
              properties: {
                brand_html: { type: "string", format: "uri" },
                search_html: { type: "string", format: "uri" },
                pricing_api: { type: "string", format: "uri" },
              },
            },
          },
        },
        ListingCard: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "slug",
            "title",
            "brand",
            "model",
            "condition",
            "condition_label",
            "section",
            "board_type",
            "dimensions",
            "price_usd",
            "price_cents",
            "city",
            "state",
            "shipping_available",
            "local_pickup",
            "image_url",
            "urls",
          ],
          properties: {
            id: { type: "string" },
            slug: { type: ["string", "null"] },
            title: { type: "string" },
            brand: { type: ["string", "null"] },
            model: { type: ["string", "null"] },
            condition: { type: ["string", "null"] },
            condition_label: { type: ["string", "null"] },
            section: { type: "string" },
            board_type: { type: ["string", "null"] },
            dimensions: { type: ["string", "null"] },
            price_usd: { type: "number" },
            price_cents: { type: "integer" },
            city: { type: ["string", "null"] },
            state: { type: ["string", "null"] },
            shipping_available: { type: "boolean" },
            local_pickup: { type: "boolean" },
            image_url: { type: ["string", "null"], format: "uri" },
            urls: { $ref: "#/components/schemas/ListingUrls" },
          },
        },
        ListingUrls: {
          type: "object",
          additionalProperties: false,
          required: ["html", "api"],
          properties: {
            html: { type: "string", format: "uri" },
            api: { type: "string", format: "uri" },
            seller: { type: ["string", "null"], format: "uri" },
          },
        },
        ListingResponse: {
          type: "object",
          additionalProperties: false,
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", const: true },
            data: { $ref: "#/components/schemas/ListingDetail" },
          },
        },
        ListingDetail: {
          allOf: [
            { $ref: "#/components/schemas/ListingCard" },
            {
              type: "object",
              additionalProperties: false,
              required: ["status", "description", "image_urls", "seller"],
              properties: {
                status: { type: "string" },
                description: { type: ["string", "null"] },
                image_urls: { type: "array", items: { type: "string", format: "uri" } },
                seller: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "store_url"],
                  properties: {
                    name: { type: "string" },
                    store_url: { type: ["string", "null"], format: "uri" },
                  },
                },
              },
            },
          ],
        },
        PricingResponse: {
          type: "object",
          additionalProperties: false,
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", const: true },
            data: { $ref: "#/components/schemas/PricingResult" },
          },
        },
        PricingResult: {
          type: "object",
          additionalProperties: false,
          required: ["brand", "model", "range", "asking", "sold", "recent_sold", "urls"],
          properties: {
            brand: {
              type: "object",
              additionalProperties: false,
              required: ["id", "name", "slug"],
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                slug: { type: "string" },
              },
            },
            model: {
              type: ["object", "null"],
              additionalProperties: false,
              required: ["name", "slug"],
              properties: {
                name: { type: "string" },
                slug: { type: "string" },
              },
            },
            range: { type: "string", const: "365d" },
            asking: marketStatsSchema,
            sold: marketStatsSchema,
            recent_sold: {
              type: "array",
              items: { $ref: "#/components/schemas/SoldComp" },
            },
            urls: {
              type: "object",
              additionalProperties: false,
              required: ["brand_html", "search_html", "sold_html"],
              properties: {
                brand_html: { type: "string", format: "uri" },
                search_html: { type: "string", format: "uri" },
                sold_html: { type: "string", format: "uri" },
              },
            },
          },
        },
        SoldComp: {
          type: "object",
          additionalProperties: false,
          required: [
            "sold_price_usd",
            "sold_at",
            "condition",
            "condition_label",
            "dimensions",
            "title",
            "listing_url",
          ],
          properties: {
            sold_price_usd: { type: "number" },
            sold_at: { type: "string", format: "date" },
            condition: { type: ["string", "null"] },
            condition_label: { type: ["string", "null"] },
            dimensions: { type: ["string", "null"] },
            title: { type: ["string", "null"] },
            listing_url: { type: ["string", "null"], format: "uri" },
          },
        },
      },
    },
  }
}
