import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SavedListContent } from "@/components/saved-list-content"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Saved listings — Reswell",
  description: "Your saved surfboard listings on Reswell.",
  path: "/favorites",
  robots: { index: false, follow: false },
})

export default async function FavoritesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/favorites")}`)
  }

  return (
      <main className="flex-1">
        <section className="container mx-auto py-8">
          <SavedListContent />
        </section>
      </main>
  )
}
