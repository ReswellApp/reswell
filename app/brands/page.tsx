import type { Metadata } from "next"
import { BrandsExplorer } from "@/components/brands/brands-explorer"
import { BrandsListAdminBar } from "@/components/brands/brands-list-admin-bar"
import { createClient } from "@/lib/supabase/server"
import { listBrands } from "@/lib/brands/server"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Surf Brands",
  description: "Surfboard brands on Reswell — profiles from our catalog.",
}

export default async function BrandsPage() {
  const supabase = await createClient()
  const brands = await listBrands(supabase)

  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="absolute right-4 top-10 sm:right-6 sm:top-12">
            <BrandsListAdminBar />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Directory</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">Surf Brands</h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              Shapers and labels in the Reswell catalog — locations, story, and links to shop official gear or search
              listings here.
            </p>
          </div>
        </div>
      </section>
      <BrandsExplorer brands={brands} />
    </main>
  )
}
