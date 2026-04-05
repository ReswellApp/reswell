import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { CollectionSpotRequestForm } from "@/components/collections/collection-spot-request-form"
import { CollectionsPressSection } from "@/components/collections/collections-press-section"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Collections",
  description: "Surf stories and community features on Reswell. Request a spot to showcase your quiver.",
}

export default async function CollectionsPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()

  return (
    <main className="flex-1">
      <div className="relative overflow-hidden border-b border-border/80 bg-gradient-to-b from-muted/40 via-background to-background">
        <div
          className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Community</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
            Collections
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Editorial features and press. Request a spot if you&apos;d like your quiver considered for a future
            feature.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <CollectionsPressSection />

        <div className="mx-auto mt-14 max-w-xl lg:mt-20">
          <CollectionSpotRequestForm isLoggedIn={!!auth.user} loginRedirectPath="/collections" />
        </div>
      </div>
    </main>
  )
}
