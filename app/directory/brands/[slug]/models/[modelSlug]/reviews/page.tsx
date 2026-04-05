import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, Star } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BoardModelReviewForm } from "@/components/index-directory/board-model-review-form"
import { AccentStarRow } from "@/components/index-directory/board-model-rating-section"
import { createClient } from "@/lib/supabase/server"
import {
  getBoardModelReviewStats,
  listBoardModelReviews,
} from "@/lib/board-model-reviews"
import {
  getAllBrandModelStaticParams,
  getBrandModelPagePayload,
} from "@/lib/index-directory/model-details-registry"
import { INDEX_DIRECTORY_BASE } from "@/lib/index-directory/routes"

export const revalidate = 60

export function generateStaticParams() {
  return getAllBrandModelStaticParams()
}

type Props = { params: Promise<{ slug: string; modelSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, modelSlug } = await params
  const payload = getBrandModelPagePayload(slug, modelSlug)
  if (!payload) {
    return { title: "Reviews" }
  }
  const { brand, model } = payload
  return {
    title: `Reviews — ${model.name} (${brand.name})`,
    description: `Community ratings and write-ups for the ${model.name} by ${brand.name}.`,
  }
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= rating
        return (
          <Star
            key={i}
            className={`h-3.5 w-3.5 shrink-0 ${!on ? "text-muted-foreground/45" : ""}`}
            fill={on ? "#fbbf24" : "none"}
            stroke={on ? "#d97706" : "currentColor"}
            strokeWidth={on ? 1.1 : 1.25}
          />
        )
      })}
    </div>
  )
}

export default async function BoardModelReviewsPage({ params }: Props) {
  const { slug, modelSlug } = await params
  const payload = getBrandModelPagePayload(slug, modelSlug)
  if (!payload) {
    notFound()
  }

  const { brand, model } = payload
  const supabase = await createClient()
  const [{ avgRating, reviewCount }, reviews, { data: { user } }] = await Promise.all([
    getBoardModelReviewStats(supabase, slug, modelSlug),
    listBoardModelReviews(supabase, slug, modelSlug),
    supabase.auth.getUser(),
  ])

  const modelHref = `${INDEX_DIRECTORY_BASE}/brands/${slug}/models/${modelSlug}`
  const reviewsPath = `${modelHref}/reviews`

  let initialRating = 0
  let initialComment = ""
  if (user) {
    const mine = reviews.find((r) => r.reviewer_id === user.id)
    if (mine) {
      initialRating = mine.rating
      initialComment = mine.comment ?? ""
    }
  }

  const loginHref = `/auth/login?redirect=${encodeURIComponent(reviewsPath)}`

  return (
    <main className="flex-1 bg-background">
      <div className="border-b border-border/40 bg-muted/[0.35]">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <nav className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground sm:text-sm">
            <Link
              href={INDEX_DIRECTORY_BASE}
              className="rounded-md px-1 py-0.5 transition-colors hover:bg-background hover:text-foreground"
            >
              Index
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
            <Link
              href={`${INDEX_DIRECTORY_BASE}/brands/${brand.slug}`}
              className="rounded-md px-1 py-0.5 transition-colors hover:bg-background hover:text-foreground"
            >
              <span className="line-clamp-1">{brand.name}</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
            <Link
              href={modelHref}
              className="rounded-md px-1 py-0.5 transition-colors hover:bg-background hover:text-foreground"
            >
              <span className="line-clamp-1">{model.name}</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
            <span className="line-clamp-1 text-foreground">Reviews</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <header className="border-b border-border/30 pb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {brand.name}
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Reviews · {model.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <AccentStarRow value={reviewCount > 0 ? avgRating : 0} />
            {reviewCount > 0 ? (
              <span className="tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{avgRating.toFixed(1)}</span> average ·{" "}
                {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </span>
            ) : (
              <span className="text-muted-foreground">No reviews yet</span>
            )}
          </div>
          <Button asChild variant="link" className="mt-4 h-auto p-0 text-sm">
            <Link href={modelHref}>← Back to model page</Link>
          </Button>
        </header>

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold">Your review</h2>
          {user ? (
            <BoardModelReviewForm
              brandSlug={slug}
              modelSlug={modelSlug}
              initialRating={initialRating}
              initialComment={initialComment}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                <p>Sign in to rate this board and share how it surfs for you.</p>
                <Button asChild className="mt-4">
                  <Link href={loginHref}>Sign in</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold mb-4">All reviews</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet — add the first one above.</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((review) => {
                const name = review.profiles?.display_name?.trim() || "Member"
                const initial = name.charAt(0).toUpperCase()
                return (
                  <li key={review.id}>
                    <Card>
                      <CardContent className="py-4 px-4 sm:px-5">
                        <div className="flex gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={review.profiles?.avatar_url || ""} alt="" />
                            <AvatarFallback>{initial}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 gap-y-1">
                              <p className="font-medium text-foreground">{name}</p>
                              <ReviewStars rating={review.rating} />
                              <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                                {review.created_at
                                  ? new Date(review.created_at).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : null}
                              </span>
                            </div>
                            {review.comment ? (
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                {review.comment}
                              </p>
                            ) : (
                              <p className="mt-2 text-sm italic text-muted-foreground">No written comment.</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
