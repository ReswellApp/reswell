import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import {
  getReswellPlatformReviewSummary,
  getReswellPlatformReviews,
} from "@/lib/db/reswellPlatformReviews"
import { ReswellReviewsPageView } from "@/components/features/reswell/reswell-reviews-page-view"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata: Metadata = pageSeoMetadata({
  title: "Reswell Reviews",
  description: "Read what surfers and sellers say about buying and selling on Reswell.",
  path: "/reswellreviews",
  robots: { index: true, follow: true },
})

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
