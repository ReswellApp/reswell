import { revalidateBlogPaths } from "@/lib/blog/revalidate-blog"
import { getBrandBySlug } from "@/lib/brands/server"
import { updateBlogPostListingFlags, getBlogPostAdminById, listAllBlogPostsAdmin, mapBlogRowToArticle } from "@/lib/db/blog-posts"
import {
  assertStaffMcpPrincipalActive,
  principalHasScope,
} from "@/lib/services/mcpAuth"
import {
  adminCreateBlogPostService,
  adminGetBlogArticleService,
  adminListBlogArticlesService,
  adminUpdateBlogPostService,
  adminBlogPostVisibilityActionService,
} from "@/lib/services/blogPostsAdmin"
import {
  createBrandModelService,
  listBrandModelsAdminService,
  updateBrandModelService,
} from "@/lib/services/brandModels"
import {
  staffCreateBrandService,
  staffGetBrandService,
  staffListBrandsService,
  staffUpdateBrandService,
} from "@/lib/services/staffCatalog"
import { findStaffMcpToolDefinition } from "@/lib/services/staffMcpToolCatalog"
import { getDb } from "@/lib/supabase/db"
import type { McpAccessPrincipal, McpToolCallResult } from "@/lib/types/mcp"
import {
  staffCreateBlogPostArgsSchema,
  staffCreateBrandArgsSchema,
  staffCreateModelArgsSchema,
  staffGetBlogPostArgsSchema,
  staffGetBrandArgsSchema,
  staffGetModelArgsSchema,
  staffListBlogPostsArgsSchema,
  staffListBrandsArgsSchema,
  staffListModelsArgsSchema,
  staffSetBlogVisibilityArgsSchema,
  staffUpdateBlogPostArgsSchema,
  staffUpdateBrandArgsSchema,
  staffUpdateModelArgsSchema,
} from "@/lib/validations/staff-mcp"

function textResult(text: string, isError = false): McpToolCallResult {
  return {
    content: [{ type: "text", text }],
    isError,
  }
}

function jsonResult(payload: unknown, summary: string): McpToolCallResult {
  return {
    content: [{ type: "text", text: `${summary}\n${JSON.stringify(payload, null, 2)}` }],
    structuredContent: typeof payload === "object" && payload ? (payload as Record<string, unknown>) : { data: payload },
  }
}

function staffDb() {
  return getDb({ consistency: "strong", purpose: "analytics" })
}

export async function callStaffMcpToolService(
  principal: McpAccessPrincipal,
  name: string,
  args: unknown,
): Promise<McpToolCallResult> {
  const tool = findStaffMcpToolDefinition(name)
  if (!tool) {
    return textResult(`Unknown tool: ${name}`, true)
  }
  if (!principalHasScope(principal, tool.requiredScope)) {
    return textResult(`Missing scope ${tool.requiredScope} for tool ${name}`, true)
  }

  const staff = await assertStaffMcpPrincipalActive(principal.userId)
  if (!staff.ok) {
    return textResult(staff.error, true)
  }

  try {
    switch (name) {
      case "list_brands": {
        const parsed = staffListBrandsArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const result = await staffListBrandsService(parsed.data)
        if (!result.ok) return textResult(result.error, true)
        return jsonResult(
          { brands: result.brands, count: result.brands.length },
          `Found ${result.brands.length} brand(s).`,
        )
      }
      case "get_brand": {
        const parsed = staffGetBrandArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const result = await staffGetBrandService(parsed.data)
        if (!result.ok) return textResult(result.error, true)
        return jsonResult({ brand: result.brand }, `Brand ${result.brand.slug}`)
      }
      case "create_brand": {
        const parsed = staffCreateBrandArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const result = await staffCreateBrandService(parsed.data)
        if (!result.ok) return textResult(result.error, true)
        return jsonResult({ brand: result.brand }, `Created brand ${result.brand.slug} (live).`)
      }
      case "update_brand": {
        const parsed = staffUpdateBrandArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const result = await staffUpdateBrandService(parsed.data)
        if (!result.ok) return textResult(result.error, true)
        return jsonResult({ brand: result.brand }, `Updated brand ${result.brand.slug} (live).`)
      }
      case "list_models": {
        const parsed = staffListModelsArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const supabase = staffDb()
        let brandId = parsed.data.brand_id
        if (!brandId && parsed.data.brand_slug) {
          const brand = await getBrandBySlug(supabase, parsed.data.brand_slug.trim().toLowerCase())
          if (!brand) return textResult("Brand not found", true)
          brandId = brand.id
        }
        const result = await listBrandModelsAdminService(supabase, brandId)
        if (!result.ok) return textResult(result.error, true)
        const q = parsed.data.query?.trim().toLowerCase()
        let rows = result.rows
        if (q) {
          rows = rows.filter(
            (row) =>
              row.name.toLowerCase().includes(q) ||
              row.brand.name.toLowerCase().includes(q) ||
              row.brand.slug.toLowerCase().includes(q),
          )
        }
        rows = rows.slice(0, parsed.data.limit)
        return jsonResult({ models: rows, count: rows.length }, `Found ${rows.length} model(s).`)
      }
      case "get_model": {
        const parsed = staffGetModelArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const supabase = staffDb()
        const { data, error } = await supabase
          .from("brand_models")
          .select(
            "id, brand_id, name, description, image_url, product_category_slug, board_category_slug, created_at, updated_at, brands:brand_id ( id, name, slug )",
          )
          .eq("id", parsed.data.model_id)
          .maybeSingle()
        if (error) return textResult(error.message, true)
        if (!data) return textResult("Model not found", true)
        const brandJoin = data.brands as
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null
        const brand = Array.isArray(brandJoin) ? brandJoin[0] : brandJoin
        const model = {
          id: data.id as string,
          brand_id: data.brand_id as string,
          name: data.name as string,
          description: (data.description as string | null) ?? null,
          image_url: (data.image_url as string | null) ?? null,
          product_category_slug: (data.product_category_slug as string) ?? "surfboards",
          board_category_slug: (data.board_category_slug as string | null) ?? null,
          created_at: data.created_at as string,
          updated_at: data.updated_at as string,
          brand: brand
            ? { id: brand.id, name: brand.name, slug: brand.slug }
            : null,
        }
        return jsonResult({ model }, `Model ${model.name}`)
      }
      case "create_model": {
        const parsed = staffCreateModelArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const result = await createBrandModelService(staffDb(), {
          brand_id: parsed.data.brand_id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          image_url: parsed.data.image_url ?? null,
          product_category_slug: parsed.data.product_category_slug,
          board_category_slug: parsed.data.board_category_slug ?? null,
        })
        if (!result.ok) return textResult(result.error, true)
        return jsonResult({ model: result.row }, `Created model ${result.row.name} (live).`)
      }
      case "update_model": {
        const parsed = staffUpdateModelArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const result = await updateBrandModelService(
          staffDb(),
          parsed.data.model_id,
          parsed.data.patch,
        )
        if (!result.ok) return textResult(result.error, true)
        return jsonResult(
          { model_id: parsed.data.model_id, updated: true },
          `Updated model ${parsed.data.model_id} (live).`,
        )
      }
      case "list_blog_posts": {
        const parsed = staffListBlogPostsArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const articles = await adminListBlogArticlesService(staffDb())
        const q = parsed.data.query?.trim().toLowerCase()
        let rows = articles
        if (parsed.data.published_only) rows = rows.filter((a) => a.published)
        if (q) {
          rows = rows.filter(
            (a) =>
              a.title.toLowerCase().includes(q) ||
              a.slug.toLowerCase().includes(q) ||
              a.tag.toLowerCase().includes(q),
          )
        }
        rows = rows.slice(0, parsed.data.limit)
        const summaries = rows.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          author: a.author,
          published: a.published,
          listedOnBlog: a.listedOnBlog,
          publishedAt: a.publishedAt,
          tag: a.tag,
        }))
        return jsonResult({ posts: summaries, count: summaries.length }, `Found ${summaries.length} post(s).`)
      }
      case "get_blog_post": {
        const parsed = staffGetBlogPostArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const supabase = staffDb()
        if (parsed.data.post_id) {
          const article = await adminGetBlogArticleService(supabase, parsed.data.post_id)
          if (!article) return textResult("Post not found", true)
          return jsonResult({ post: article }, `Post ${article.slug}`)
        }
        const slug = parsed.data.slug!.trim().toLowerCase()
        const rows = await listAllBlogPostsAdmin(supabase)
        const row = rows.find((r) => r.slug === slug)
        if (!row) return textResult("Post not found", true)
        return jsonResult({ post: mapBlogRowToArticle(row) }, `Post ${row.slug}`)
      }
      case "create_blog_post": {
        const parsed = staffCreateBlogPostArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const result = await adminCreateBlogPostService(staffDb(), parsed.data)
        if (!result.ok) return textResult(result.error, true)
        revalidateBlogPaths(parsed.data.slug)
        return jsonResult(
          {
            id: result.id,
            slug: parsed.data.slug,
            published: parsed.data.published,
          },
          parsed.data.published
            ? `Published blog post ${parsed.data.slug} (live).`
            : `Created draft blog post ${parsed.data.slug}.`,
        )
      }
      case "update_blog_post": {
        const parsed = staffUpdateBlogPostArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const result = await adminUpdateBlogPostService(
          staffDb(),
          parsed.data.post_id,
          parsed.data.draft,
        )
        if (!result.ok) return textResult(result.error, true)
        revalidateBlogPaths(parsed.data.draft.slug)
        return jsonResult(
          { id: parsed.data.post_id, slug: parsed.data.draft.slug, published: parsed.data.draft.published },
          `Updated blog post ${parsed.data.draft.slug}.`,
        )
      }
      case "set_blog_visibility": {
        const parsed = staffSetBlogVisibilityArgsSchema.safeParse(args ?? {})
        if (!parsed.success) return textResult(`Invalid arguments: ${parsed.error.message}`, true)
        const supabase = staffDb()
        if (parsed.data.action === "publish") {
          const row = await getBlogPostAdminById(supabase, parsed.data.post_id)
          if (!row) return textResult("Post not found", true)
          const r = await updateBlogPostListingFlags(supabase, parsed.data.post_id, {
            published: true,
            listed_on_blog: true,
          })
          if (!r.ok) return textResult(r.error, true)
          revalidateBlogPaths(row.slug)
          return jsonResult(
            { id: parsed.data.post_id, slug: row.slug, action: "publish" },
            `Published ${row.slug} (live on /blog).`,
          )
        }
        const result = await adminBlogPostVisibilityActionService(
          supabase,
          parsed.data.post_id,
          parsed.data.action,
        )
        if (!result.ok) return textResult(result.error, true)
        revalidateBlogPaths(result.slug)
        return jsonResult(
          { id: parsed.data.post_id, slug: result.slug, action: parsed.data.action },
          `Blog visibility updated: ${parsed.data.action} (${result.slug}).`,
        )
      }
      default:
        return textResult(`Unhandled tool: ${name}`, true)
    }
  } catch (error) {
    console.error("[staff-mcp] tool failed", {
      tool: name,
      userId: principal.userId,
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return textResult("Internal error running staff MCP tool", true)
  }
}
