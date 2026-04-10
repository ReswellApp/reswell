import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const MARKETPLACE_SECTIONS = ["surfboards"] as const

export const revalidate = 60

function anonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("Missing Supabase env")
  }
  return createClient(url, key)
}

export type SoldTickerItem = {
  id: string
  title: string
  price: number
  city: string | null
  state: string | null
}

export async function GET() {
  try {
    const supabase = anonSupabase()
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, price, city, state, updated_at")
      .eq("status", "sold")
      .eq("hidden_from_site", false)
      .in("section", [...MARKETPLACE_SECTIONS])
      .order("updated_at", { ascending: false })
      .limit(10)

    if (error) {
      console.error("[api/feed/sold-ticker]", error)
      return NextResponse.json({ items: [] satisfies SoldTickerItem[] })
    }

    const rows = (data ?? []) as Record<string, unknown>[]
    const items: SoldTickerItem[] = rows.map((row) => {
      const priceNum = Number(row.price ?? 0)
      return {
        id: String(row.id),
        title: String(row.title ?? ""),
        price: Number.isFinite(priceNum) ? priceNum : 0,
        city: row.city != null ? String(row.city) : null,
        state: row.state != null ? String(row.state) : null,
      }
    })

    return NextResponse.json({ items })
  } catch (e) {
    console.error("[api/feed/sold-ticker]", e)
    return NextResponse.json({ items: [] satisfies SoldTickerItem[] })
  }
}
