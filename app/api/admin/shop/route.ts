import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  createReswellShopProduct,
  listReswellShopAdminProducts,
} from "@/lib/services/reswellShopAdmin"

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

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  try {
    const service = createServiceRoleClient()
    const products = await listReswellShopAdminProducts(service)
    return NextResponse.json({ data: { products } })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load shop products"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

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
    const result = await createReswellShopProduct(service, parsed.data, gate.ctx.user.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ data: { id: result.id } }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create product"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
