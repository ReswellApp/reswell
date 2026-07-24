import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  archiveReswellShopProduct,
  updateReswellShopProduct,
} from "@/lib/services/reswellShopAdmin"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const packageSchema = z.object({
  lengthIn: z.number().finite().positive().max(108),
  widthIn: z.number().finite().positive().max(108),
  heightIn: z.number().finite().positive().max(108),
  weightLb: z.number().finite().positive().max(150),
})

const productSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(10000),
  price: z.number().finite().positive().max(100000),
  stock_quantity: z.number().int().min(0).max(100000),
  image_urls: z.array(z.string().trim().min(1).max(2000)).max(12).default([]),
  package: packageSchema,
  status: z.enum(["active", "sold", "draft"]).optional(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const service = createServiceRoleClient()
    const result = await updateReswellShopProduct(service, id, parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update product"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    const service = createServiceRoleClient()
    const result = await archiveReswellShopProduct(service, id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not archive product"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
