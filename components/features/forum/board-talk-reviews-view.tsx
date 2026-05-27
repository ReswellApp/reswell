"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ArrowUpDown, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BoardTalkReviewsSearch,
  type BoardTalkReviewsCatalogFilter,
} from "@/components/features/forum/board-talk-reviews-search"
import { BoardTalkReviewPhoto } from "@/components/features/forum/board-talk-review-photo"
import { useBoardTalkReviewsUi } from "@/components/features/forum/board-talk-reviews-ui-context"
import { ratingStarFilledClassName, ratingStarEmptyClassName } from "@/lib/rating-star-styles"
import type { BoardTalkReviewItem } from "@/lib/services/boardTalkReviews"
import { cn } from "@/lib/utils"

type SortOrder = "recent" | "oldest" | "highest" | "lowest"

type BoardTalkReviewsViewProps = {
  reviews: BoardTalkReviewItem[]
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating
        return (
          <Star
            key={index}
            className={cn("h-4 w-4", filled ? ratingStarFilledClassName : ratingStarEmptyClassName)}
            strokeWidth={0}
            aria-hidden
          />
        )
      })}
    </div>
  )
}

export function BoardTalkReviewsView({ reviews }: BoardTalkReviewsViewProps) {
  const reviewsUi = useBoardTalkReviewsUi()
  const [query, setQuery] = useState("")
  const [catalogFilter, setCatalogFilter] = useState<BoardTalkReviewsCatalogFilter>({
    brandSlug: null,
    modelSlug: null,
  })
  const [sort, setSort] = useState<SortOrder>("recent")
  const [minRating, setMinRating] = useState<string>("all")

  const filteredReviews = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const hasCatalogFilter = Boolean(catalogFilter.brandSlug || catalogFilter.modelSlug)

    let next = reviews.filter((review) => {
      if (minRating !== "all" && review.rating < Number(minRating)) return false
      if (catalogFilter.brandSlug && review.brandSlug !== catalogFilter.brandSlug) return false
      if (catalogFilter.modelSlug && review.modelSlug !== catalogFilter.modelSlug) return false
      if (hasCatalogFilter) return true
      if (!normalized) return true
      const haystack = `${review.brandName} ${review.modelName} ${review.comment ?? ""} ${review.authorName}`
      return haystack.toLowerCase().includes(normalized)
    })

    next = [...next].sort((a, b) => {
      if (sort === "recent") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (sort === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      if (sort === "highest") {
        return b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      return a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return next
  }, [catalogFilter.brandSlug, catalogFilter.modelSlug, minRating, query, reviews, sort])

  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Board Reviews</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-base">
            Community ratings for catalog board models — search, sort, and explore what surfers think.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="text-sm text-muted-foreground">Average rating</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {reviews.length > 0 ? averageRating.toFixed(1) : "—"}
                </span>
                {reviews.length > 0 ? <ReviewStars rating={Math.round(averageRating)} /> : null}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {reviews.length} review{reviews.length === 1 ? "" : "s"} in the feed
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <BoardTalkReviewsSearch
            value={query}
            catalogFilter={catalogFilter}
            onValueChange={setQuery}
            onCatalogFilterChange={setCatalogFilter}
          />
          <div className="flex flex-wrap gap-2">
            <Select value={sort} onValueChange={(value) => setSort(value as SortOrder)}>
              <SelectTrigger className="w-[170px]">
                <ArrowUpDown className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="highest">Highest rated</SelectItem>
                <SelectItem value="lowest">Lowest rated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={minRating} onValueChange={setMinRating}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="5">5 stars</SelectItem>
                <SelectItem value="4">4+ stars</SelectItem>
                <SelectItem value="3">3+ stars</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredReviews.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-14 text-center text-muted-foreground sm:px-8">
            <p>
              {reviews.length === 0
                ? "No board reviews yet — explore brands and leave the first rating."
                : "No reviews match your search or filters."}
            </p>
            {reviews.length > 0 ? (
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => {
                  setQuery("")
                  setCatalogFilter({ brandSlug: null, modelSlug: null })
                  setMinRating("all")
                  setSort("recent")
                }}
              >
                Reset filters
              </Button>
            ) : reviewsUi ? (
              <Button variant="outline" className="mt-6" onClick={reviewsUi.openPostReview}>
                Post the first review
              </Button>
            ) : (
              <Button variant="outline" asChild className="mt-6">
                <Link href="/brands">Browse brands</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4 sm:space-y-5">
          {filteredReviews.map((review) => (
            <li key={review.id}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="px-6 py-5 sm:px-8 sm:py-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <Link
                        href={review.brandHref}
                        className="text-lg font-semibold text-foreground hover:underline sm:text-xl"
                      >
                        {review.brandName} · {review.modelName}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <ReviewStars rating={review.rating} />
                        <Badge variant="outline" className="text-xs font-normal">
                          {review.authorName}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {review.comment ? (
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                  ) : null}
                  {review.photoFileName ? (
                    <div className="mt-4">
                      <BoardTalkReviewPhoto reviewId={review.id} fileName={review.photoFileName} />
                    </div>
                  ) : null}
                  <div className="mt-5">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={review.brandHref}>View brand</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
