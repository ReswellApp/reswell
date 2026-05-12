import type { Metadata } from "next"
import { SurfersDirectorySearch } from "@/components/surfers/surfers-directory-search"
import { SurfersExplorer } from "@/components/surfers/surfers-explorer"
import { SurfersListAdminBar } from "@/components/surfers/surfers-list-admin-bar"
import { createClient } from "@/lib/supabase/server"
import { listSurfers } from "@/lib/surfers/server"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const revalidate = 3600

export const metadata: Metadata = pageSeoMetadata({
  title: "Surfers directory — Reswell",
  description: "Explore surfer profiles on Reswell — stories, bios, and links to discover gear on the marketplace.",
  path: "/surfers",
})

export default async function SurfersPage() {
  const supabase = await createClient()
  const surfers = await listSurfers(supabase)

  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="absolute right-4 top-10 sm:right-6 sm:top-12">
            <SurfersListAdminBar />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Directory</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">Surfers</h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              People in the Reswell community — read bios, follow links, and search the marketplace for boards and gear
              tied to each name.
            </p>
            <div className="mx-auto mt-8 max-w-xl">
              <SurfersDirectorySearch surfers={surfers} />
            </div>
          </div>
        </div>
      </section>
      <SurfersExplorer surfers={surfers} />
    </main>
  )
}
