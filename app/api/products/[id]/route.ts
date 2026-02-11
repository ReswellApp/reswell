import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from("inventory")
    .select("id, name, price, image_url, stock_quantity")
    .eq("id", id)
    .eq("is_active", true)
    .single()

  if (error || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  return NextResponse.json(product)
}
