import type { Metadata } from "next"
import { BrandsDirectorySearch } from "@/components/brands/brands-directory-search"
import { BrandsExplorer } from "@/components/brands/brands-explorer"
import { BrandsListAdminBar } from "@/components/brands/brands-list-admin-bar"
import { createClient } from "@/lib/supabase/server"
import { listBrands } from "@/lib/brands/server"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Surf Brands",
  description: "Surfboard brands on Reswell — profiles from our catalog.",
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ brandRequest?: string }>
}) {
  const sp = await searchParams
  const raw = sp.brandRequest
  const brandRequestImportId =
    typeof raw === "string" && UUID_RE.test(raw.trim()) ? raw.trim() : undefined

  const supabase = await createClient()
  const brands = await listBrands(supabase)

  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="absolute right-4 top-10 sm:right-6 sm:top-12">
            <BrandsListAdminBar brandRequestImportId={brandRequestImportId} />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Directory</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">Surf Brands</h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              Shapers and labels in the Reswell catalog — locations, story, and links to shop official gear or search
              listings here.
            </p>
            <div className="mx-auto mt-8 max-w-xl">
              <BrandsDirectorySearch brands={brands} />
            </div>
          </div>
        </div>
      </section>
      <BrandsExplorer brands={brands} />
    </main>
  )
}
