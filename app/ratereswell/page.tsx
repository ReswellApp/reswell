import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getReswellPlatformReviewByUserId } from "@/lib/db/reswellPlatformReviews"
import { RateReswellForm } from "@/components/features/reswell/rate-reswell-form"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("ratereswell")
}

function splitStoredReviewContent(description: string): { title: string; body: string } {
  const trimmed = description.trim()
  if (!trimmed) {
    return { title: "", body: "" }
  }

  const parts = trimmed.split(/\n\n/)
  if (parts.length >= 2 && parts[0].length <= 120) {
    return { title: parts[0], body: parts.slice(1).join("\n\n") }
  }

  return { title: "", body: trimmed }
}

export default async function RateReswellPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/ratereswell")}`)
  }

  const [{ data: existingReview }, { data: profile }] = await Promise.all([
    getReswellPlatformReviewByUserId(supabase, user.id),
    supabase
      .from("profiles")
      .select("display_name, shop_name")
      .eq("id", user.id)
      .maybeSingle(),
  ])

  const profileName =
    (profile?.shop_name as string | null)?.trim() ||
    (profile?.display_name as string | null)?.trim() ||
    ""

  const parsedReview = existingReview
    ? splitStoredReviewContent(existingReview.description)
    : { title: "", body: "" }

  return (
    <main className="flex-1 bg-background py-10 sm:py-14">
      <div className="container mx-auto max-w-xl px-4 sm:px-6">
        <RateReswellForm
          initialFullName={existingReview?.full_name ?? profileName}
          initialTitle={parsedReview.title}
          initialDescription={parsedReview.body}
          initialRating={existingReview?.rating ?? 5}
          hasExistingReview={!!existingReview}
        />
      </div>
    </main>
  )
}
