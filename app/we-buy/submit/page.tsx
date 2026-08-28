import { redirect } from "next/navigation"
import { WeBuySubmitForm } from "@/components/features/board-buy/we-buy-submit-form"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"

export const metadata = privatePageMetadata({
  title: "Submit your board — We’ll buy it — Reswell",
  description: "Photos, title, and asking price. Reswell replies in under 30 minutes.",
  path: "/we-buy/submit",
})

export default async function WeBuySubmitPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user || isAnonymousSupabaseUser(data.user)) {
    redirect("/auth/login?redirect=/we-buy/submit")
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="font-headline text-3xl font-bold text-[#001A4A]">Get a quote</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We’ll accept your asking price or send our best offer within 30 minutes. You’ll be required
        to ship in a box no more than 22&quot; wide and 5&quot; high. We buy a prepaid label only
        after you pack the board and submit those measurements.
      </p>
      <div className="mt-8">
        <WeBuySubmitForm userId={data.user.id} />
      </div>
    </main>
  )
}
