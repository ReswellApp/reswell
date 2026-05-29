import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import {
  getReswellPlatformReviewSummary,
  getReswellPlatformReviews,
} from "@/lib/db/reswellPlatformReviews"
import { ReswellReviewsPageView } from "@/components/features/reswell/reswell-reviews-page-view"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("reswellreviews")
}

export default async function ReswellReviewsPage() {
  const supabase = await createClient()

  const [
    { data: summary },
    { data: reviews },
    {
      data: { user },
    },
  ] = await Promise.all([
    getReswellPlatformReviewSummary(supabase),
    getReswellPlatformReviews(supabase),
    supabase.auth.getUser(),
  ])

  const writeReviewHref = user ? "/ratereswell" : "/auth/login?redirect=%2Fratereswell"

  return (
    <ReswellReviewsPageView
      reviews={reviews}
      summary={summary}
      writeReviewHref={writeReviewHref}
    />
  )
}
