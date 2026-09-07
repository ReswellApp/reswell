"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Globe,
  Info,
  MapPin,
  PenLine,
  Search,
  Share2,
  ThumbsUp,
} from "lucide-react"
import type { ReswellPlatformReviewRow, ReswellPlatformReviewSummary } from "@/lib/db/reswellPlatformReviews"
import {
  computeReswellPlatformStarDistribution,
  formatReswellReviewCount,
  initialsFromFullName,
  RESWELL_REVIEW_MENTION_TAGS,
  truncateReviewText,
  type ReswellPlatformStarDistribution,
} from "@/lib/reswell-platform-review-stats"
import { reswellPlatformRatingLabel } from "@/lib/reswell-platform-rating-labels"
import {
  ReswellPlatformSingleStar,
  ReswellPlatformStarBoxRow,
} from "@/components/features/reswell/reswell-platform-star-boxes"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type SortOrder = "recent" | "oldest" | "highest" | "lowest"

interface ReswellReviewsPageViewProps {
  reviews: ReswellPlatformReviewRow[]
  summary: ReswellPlatformReviewSummary
  writeReviewHref: string
}

const distributionBarColors: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: "bg-listingHeart",
  4: "bg-listingHeart/70",
  3: "bg-amber-400",
  2: "bg-orange-400",
  1: "bg-red-500",
}

function ReviewerAvatar({ name }: { name: string }) {
  const initials = initialsFromFullName(name) || "?"

  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
      {initials}
    </span>
  )
}

function StarDistributionBars({
  distribution,
  className,
}: {
  distribution: ReswellPlatformStarDistribution[]
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {distribution.map((row) => (
        <div key={row.stars} className="grid grid-cols-[2.75rem_1fr_2.5rem] items-center gap-2 text-xs">
          <span className="text-muted-foreground">{row.stars}-star</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", distributionBarColors[row.stars])}
              style={{ width: `${row.percent}%` }}
            />
          </div>
          <span className="text-right tabular-nums text-muted-foreground">{row.percent}%</span>
        </div>
      ))}
    </div>
  )
}

function HighlightReviewCard({ review }: { review: ReswellPlatformReviewRow }) {
  const { text, truncated } = truncateReviewText(review.description, 150)

  return (
    <article className="flex h-full w-[min(100%,19rem)] shrink-0 snap-start flex-col rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ReviewerAvatar name={review.full_name} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{review.full_name}</p>
          <time
            dateTime={review.created_at}
            className="text-xs text-muted-foreground"
          >
            {new Date(review.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </div>
      </div>

      <div className="mt-3">
        <ReswellPlatformStarBoxRow value={review.rating} size="sm" />
      </div>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {text}
        {truncated ? (
          <>
            {" "}
            <span className="font-medium text-listingHeart">See more</span>
          </>
        ) : null}
      </p>

      <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
          Useful
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          Share
        </span>
        <Flag className="ml-auto h-3.5 w-3.5" aria-hidden />
      </div>
    </article>
  )
}

function FeedReviewCard({ review }: { review: ReswellPlatformReviewRow }) {
  return (
    <article className="border-b border-border/70 py-6 last:border-b-0">
      <div className="flex items-start gap-3">
        <ReviewerAvatar name={review.full_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">{review.full_name}</p>
              <p className="text-xs text-muted-foreground">Reswell member</p>
            </div>
            <RelativeTime
              iso={review.created_at}
              formatLabel={formatDistanceToNowLabel}
              className="text-xs text-muted-foreground"
            />
          </div>

          <div className="mt-3">
            <ReswellPlatformStarBoxRow value={review.rating} size="sm" />
          </div>

          <p className="mt-3 text-sm leading-relaxed text-foreground">{review.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border/80 px-2 py-1 text-xs text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="rounded-md border border-border/80 px-2 py-1 text-xs text-muted-foreground">
              Verified review
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
              Useful
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              Share
            </span>
            <Flag className="ml-auto h-3.5 w-3.5" aria-hidden />
          </div>
        </div>
      </div>
    </article>
  )
}

export function ReswellReviewsPageView({
  reviews,
  summary,
  writeReviewHref,
}: ReswellReviewsPageViewProps) {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent")
  const [selectedStars, setSelectedStars] = useState<number[]>([])
  const [selectedMention, setSelectedMention] = useState<string | null>(null)

  const distribution = useMemo(() => computeReswellPlatformStarDistribution(reviews), [reviews])
  const hasReviews = summary.reviewCount > 0
  const ratingLabel = hasReviews ? reswellPlatformRatingLabel(summary.avgRating) : "No rating yet"
  const highlightReviews = reviews.slice(0, 8)

  const filteredReviews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    let next = reviews.filter((review) => {
      if (selectedStars.length > 0 && !selectedStars.includes(review.rating)) {
        return false
      }

      if (selectedMention) {
        const haystack = `${review.full_name} ${review.description}`.toLowerCase()
        if (!haystack.includes(selectedMention.toLowerCase())) {
          return false
        }
      }

      if (!query) {
        return true
      }

      return (
        review.full_name.toLowerCase().includes(query) ||
        review.description.toLowerCase().includes(query)
      )
    })

    next = [...next].sort((a, b) => {
      switch (sortOrder) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "highest":
          return b.rating - a.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "lowest":
          return a.rating - b.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return next
  }, [reviews, searchQuery, selectedMention, selectedStars, sortOrder])

  const toggleStarFilter = (stars: number, checked: boolean) => {
    setSelectedStars((current) => {
      if (checked) {
        return current.includes(stars) ? current : [...current, stars]
      }
      return current.filter((value) => value !== stars)
    })
  }

  const scrollCarousel = (direction: "left" | "right") => {
    const element = carouselRef.current
    if (!element) return
    const offset = direction === "left" ? -320 : 320
    element.scrollBy({ left: offset, behavior: "smooth" })
  }

  return (
    <main className="flex-1 bg-background">
      <section className="border-b border-border/70">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <SiteWordmarkLink
                  href="/"
                  className="shrink-0 px-0"
                  imgClassName="max-h-16 max-w-[11rem] sm:max-h-20 sm:max-w-[13rem]"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      Reswell marketplace
                    </span>
                  </div>

                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Reswell
                  </h1>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <Link
                      href="#all-reviews"
                      className="font-semibold text-foreground underline underline-offset-4"
                    >
                      Reviews {summary.reviewCount.toLocaleString("en-US")}
                    </Link>
                    {hasReviews ? (
                      <>
                        <ReswellPlatformStarBoxRow value={summary.avgRating} size="sm" />
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                          {summary.avgRating.toFixed(1)}
                          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        </span>
                      </>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm text-listingHeart">Surf marketplace</p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button asChild className="rounded-full bg-listingHeart text-white hover:bg-[#2a4170]">
                      <Link href={writeReviewHref}>
                        <PenLine className="h-4 w-4" aria-hidden />
                        Write a review
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm lg:p-6">
              <div className="flex items-start gap-3">
                <ReswellPlatformSingleStar className="mt-1 h-7 w-7" />
                <div>
                  <p className="text-4xl font-bold tracking-tight text-foreground">
                    {hasReviews ? summary.avgRating.toFixed(1) : "—"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{ratingLabel}</p>
                </div>
              </div>

              {hasReviews ? (
                <>
                  <div className="mt-4">
                    <ReswellPlatformStarBoxRow value={summary.avgRating} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {formatReswellReviewCount(summary.reviewCount)} reviews
                  </p>
                  <div className="mt-5">
                    <StarDistributionBars distribution={distribution} />
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Reviews will appear here once the community starts sharing feedback.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {highlightReviews.length > 0 ? (
        <section className="border-b border-border/70">
          <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Recent reviews
              </h2>
              <div className="hidden items-center gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => scrollCarousel("left")}
                  aria-label="Scroll reviews left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => scrollCarousel("right")}
                  aria-label="Scroll reviews right"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div
              ref={carouselRef}
              className="mt-5 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
            >
              {highlightReviews.map((review) => (
                <HighlightReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-border/70">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <h2 className="text-base font-semibold text-foreground">Company details</h2>
            </div>
            <div>
              <span className="inline-flex rounded-md border border-border/80 px-2.5 py-1 text-sm font-medium text-listingHeart">
                Surf marketplace
              </span>
              <p className="mt-4 text-sm font-semibold text-foreground">
                The peer-to-peer marketplace for surfers
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Reswell helps surfers buy and sell boards and gear with checkout, messaging, shipping
                tools, and Purchase Protection on eligible orders.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-10 border-t border-border/70 pt-10 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <h2 className="text-base font-semibold text-foreground">Contact info</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                United States
              </p>
              <p className="inline-flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0" aria-hidden />
                <Link href="/" className="font-medium text-listingHeart underline underline-offset-4">
                  reswell.app
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="all-reviews" className="scroll-mt-24">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ReswellPlatformSingleStar />
                  <span className="text-2xl font-bold text-foreground">
                    {hasReviews ? summary.avgRating.toFixed(1) : "—"}
                  </span>
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">All reviews</h2>
                    <p className="text-sm text-muted-foreground">
                      {summary.reviewCount.toLocaleString("en-US")} total
                    </p>
                  </div>
                  <Link
                    href={writeReviewHref}
                    className="text-sm font-semibold text-listingHeart underline underline-offset-4"
                  >
                    Write a review
                  </Link>
                </div>

                {hasReviews ? (
                  <div className="mt-5 space-y-3">
                    {distribution.map((row) => (
                      <label
                        key={row.stars}
                        className="grid cursor-pointer grid-cols-[1rem_3rem_1fr_2.5rem] items-center gap-2 text-xs"
                      >
                        <Checkbox
                          checked={selectedStars.includes(row.stars)}
                          onCheckedChange={(checked) => toggleStarFilter(row.stars, checked === true)}
                          aria-label={`Filter ${row.stars}-star reviews`}
                        />
                        <span className="text-muted-foreground">{row.stars}-star</span>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", distributionBarColors[row.stars])}
                            style={{ width: `${row.percent}%` }}
                          />
                        </div>
                        <span className="text-right tabular-nums text-muted-foreground">
                          {row.percent}%
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </aside>

            <div>
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/80 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100">
                <div className="flex gap-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    Reswell has a zero-tolerance policy for fake reviews. We fight harder for surfers
                    than scammers, and we show every review exactly as it&apos;s written.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by keyword..."
                    className="rounded-full pl-9"
                    aria-label="Search reviews"
                  />
                </div>
                <Select value={sortOrder} onValueChange={(value: SortOrder) => setSortOrder(value)}>
                  <SelectTrigger className="w-full rounded-full sm:w-[180px]">
                    <SelectValue placeholder="Most recent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most recent</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="highest">Highest rated</SelectItem>
                    <SelectItem value="lowest">Lowest rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-5">
                <Label className="text-sm font-medium text-foreground">Top mentions</Label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {RESWELL_REVIEW_MENTION_TAGS.map((tag) => {
                    const active = selectedMention === tag
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedMention(active ? null : tag)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-listingHeart bg-listingHeart text-white"
                            : "border-border/80 bg-background text-foreground hover:bg-muted",
                        )}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6">
                {filteredReviews.length > 0 ? (
                  filteredReviews.map((review) => <FeedReviewCard key={review.id} review={review} />)
                ) : (
                  <div className="rounded-2xl border border-border/80 bg-card px-6 py-10 text-center shadow-sm">
                    <p className="text-lg font-semibold text-foreground">No reviews match your filters</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try clearing your search or star filters to see more feedback.
                    </p>
                    {reviews.length === 0 ? (
                      <Button asChild className="mt-6 rounded-full bg-listingHeart text-white hover:bg-[#2a4170]">
                        <Link href={writeReviewHref}>Write a review</Link>
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
