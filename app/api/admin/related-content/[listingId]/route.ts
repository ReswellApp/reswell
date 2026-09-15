import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  adminAddRelatedContentBodySchema,
  adminReorderRelatedContentBodySchema,
  relatedContentListingIdSchema,
} from "@/lib/validations/listing-related-content"
import {
  addRelatedContentItemService,
  getRelatedContentDetailForAdminService,
  reorderRelatedContentItemsService,
} from "@/lib/services/listingRelatedContent"

type RouteContext = { params: Promise<{ listingId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { listingId } = await context.params
  const parsedId = relatedContentListingIdSchema.safeParse(listingId)
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }

  const result = await getRelatedContentDetailForAdminService(parsedId.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { listing: result.listing, items: result.items } }, { status: 200 })
}

export async function POST(request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { listingId } = await context.params
  const parsedId = relatedContentListingIdSchema.safeParse(listingId)
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminAddRelatedContentBodySchema.safeParse(json)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    const msg =
      [...flat.formErrors, ...Object.values(flat.fieldErrors).flat()].find(
        (value): value is string => typeof value === "string" && value.length > 0,
      ) || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await addRelatedContentItemService({
    listingId: parsedId.data,
    kind: parsed.data.kind,
    blogPostId: parsed.data.blog_post_id,
    relatedListingId: parsed.data.related_listing_id,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { id: result.id } }, { status: 201 })
}

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { listingId } = await context.params
  const parsedId = relatedContentListingIdSchema.safeParse(listingId)
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminReorderRelatedContentBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await reorderRelatedContentItemsService(parsedId.data, parsed.data.ordered_row_ids)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { reordered: true } }, { status: 200 })
}
