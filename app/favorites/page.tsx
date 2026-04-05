import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SavedListContent } from "@/components/saved-list-content"

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
