import { principalHasScope } from "@/lib/services/mcpAuth"
import type { McpAccessPrincipal, McpToolDefinition } from "@/lib/types/mcp"
import type { McpStaffScope } from "@/lib/types/mcp"

export const STAFF_MCP_INSTRUCTIONS = [
  "You are helping Reswell staff manage the brand catalog and blog CMS.",
  "Writes go straight to production Supabase and revalidate public pages — no git commit or deploy.",
  "Prefer list/get tools before create/update. Confirm brand slug and model names carefully.",
  "For blog posts: draft with published:false first unless the user explicitly asks to publish.",
  "Blog cover/image URLs must be copyright-free (Unsplash, Pexels, Pixabay, Wikimedia, or Reswell-owned).",
  "Do not invent catalog models. Use official brand/model names from the shaper or existing rows.",
  "Tools you were not granted scopes for will not appear in tools/list.",
].join(" ")

type StaffToolDefinition = Omit<McpToolDefinition, "requiredScope"> & {
  requiredScope: McpStaffScope
}

export const STAFF_MCP_ALL_TOOLS: StaffToolDefinition[] = [
  {
    name: "list_brands",
    title: "List brands",
    description: "Search or list brands in the Reswell catalog directory.",
    requiredScope: "catalog:read",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional name/slug filter" },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Max rows (default 40)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_brand",
    title: "Get brand",
    description: "Load one brand by id or slug.",
    requiredScope: "catalog:read",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        brand_id: { type: "string", description: "Brand UUID" },
        slug: { type: "string", description: "Brand slug" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_brand",
    title: "Create brand",
    description:
      "Create a brand directory row. Goes live immediately on /brands after revalidation.",
    requiredScope: "catalog:write",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "URL slug (lowercase, hyphens)" },
        name: { type: "string" },
        short_description: { type: "string" },
        website_url: { type: "string" },
        logo_url: { type: "string" },
        founder_name: { type: "string" },
        lead_shaper_name: { type: "string" },
        location_label: { type: "string" },
        model_count: { type: "integer", minimum: 0 },
        product_categories: {
          type: "array",
          items: { type: "string" },
          description: "e.g. surfboards, fins",
        },
      },
      required: ["slug", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_brand",
    title: "Update brand",
    description: "Patch an existing brand by id or slug.",
    requiredScope: "catalog:write",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        brand_id: { type: "string" },
        slug: { type: "string" },
        patch: { type: "object", description: "Fields to update" },
      },
      required: ["patch"],
      additionalProperties: false,
    },
  },
  {
    name: "list_models",
    title: "List models",
    description: "List brand models, optionally filtered by brand or name.",
    requiredScope: "catalog:read",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        brand_id: { type: "string" },
        brand_slug: { type: "string" },
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_model",
    title: "Get model",
    description: "Load one brand model by id.",
    requiredScope: "catalog:read",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        model_id: { type: "string", description: "Model UUID" },
      },
      required: ["model_id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_model",
    title: "Create model",
    description: "Add a named model under a brand. Goes live in catalog search.",
    requiredScope: "catalog:write",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        brand_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        image_url: { type: "string" },
        product_category_slug: { type: "string" },
        board_category_slug: { type: "string" },
      },
      required: ["brand_id", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_model",
    title: "Update model",
    description: "Patch an existing brand model.",
    requiredScope: "catalog:write",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        model_id: { type: "string" },
        patch: { type: "object" },
      },
      required: ["model_id", "patch"],
      additionalProperties: false,
    },
  },
  {
    name: "list_blog_posts",
    title: "List blog posts",
    description: "List Reswell blog drafts and published posts (CMS).",
    requiredScope: "blog:read",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        published_only: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_blog_post",
    title: "Get blog post",
    description: "Load one blog post by id or slug, including blocks.",
    requiredScope: "blog:read",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        post_id: { type: "string" },
        slug: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_blog_post",
    title: "Create blog post",
    description:
      "Create a blog CMS post. Use published:false for drafts. published:true goes live on /blog after revalidation.",
    requiredScope: "blog:write",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        title: { type: "string" },
        deck: { type: "string" },
        excerpt: { type: "string" },
        author: { type: "string" },
        publishedAt: { type: "string", description: "YYYY-MM-DD" },
        readMinutes: { type: "integer" },
        tag: { type: "string" },
        coverImage: { type: "string" },
        blocks: { type: "array", items: { type: "object" } },
        seoTitle: { type: "string" },
        seoDescription: { type: "string" },
        ogImage: { type: "string" },
        published: { type: "boolean" },
        listedOnBlog: { type: "boolean" },
        sortOrder: { type: "integer" },
      },
      required: [
        "slug",
        "title",
        "deck",
        "excerpt",
        "author",
        "publishedAt",
        "readMinutes",
        "tag",
        "blocks",
        "published",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "update_blog_post",
    title: "Update blog post",
    description: "Full-replace update of a blog post (same payload as create).",
    requiredScope: "blog:write",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        post_id: { type: "string" },
        draft: { type: "object", description: "Full blog draft matching create_blog_post fields" },
      },
      required: ["post_id", "draft"],
      additionalProperties: false,
    },
  },
  {
    name: "set_blog_visibility",
    title: "Set blog visibility",
    description:
      "publish (listed + published), hide (unlist from index), show (relist), or archive (unpublish).",
    requiredScope: "blog:write",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        post_id: { type: "string" },
        action: {
          type: "string",
          enum: ["publish", "hide", "show", "archive"],
        },
      },
      required: ["post_id", "action"],
      additionalProperties: false,
    },
  },
]

export function listStaffMcpToolsForPrincipal(principal: McpAccessPrincipal): Array<{
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: McpToolDefinition["annotations"]
}> {
  return STAFF_MCP_ALL_TOOLS.filter((tool) =>
    principalHasScope(principal, tool.requiredScope),
  ).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
  }))
}

export function findStaffMcpToolDefinition(name: string): StaffToolDefinition | undefined {
  return STAFF_MCP_ALL_TOOLS.find((tool) => tool.name === name)
}
