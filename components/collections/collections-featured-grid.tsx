import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import { collectionCardImageUrl, type SurfCollectionListRow } from "@/lib/surf-collections"
import { ArrowUpRight } from "lucide-react"

function profileFromRow(row: SurfCollectionListRow) {
  const p = row.profiles
  if (Array.isArray(p)) return p[0] ?? null
  return p
}

export function CollectionsFeaturedGrid({ collections }: { collections: SurfCollectionListRow[] }) {
  if (collections.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 px-6 py-16 text-center">
        <p className="text-lg font-medium text-foreground">Featured quivers coming soon</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
          We’re lining up the first collector showcases. Request a spot below if you’d like yours considered.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((row, i) => {
        const profile = profileFromRow(row)
        const ownerName = getPublicSellerDisplayName(profile)
        const img = collectionCardImageUrl(row)
        const large = i === 0 && collections.length >= 3

        return (
          <Link
            key={row.id}
            href={`/collections/${row.slug}`}
            className={[
              "group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-sm transition-shadow hover:shadow-md",
              large ? "sm:col-span-2 lg:col-span-2 lg:row-span-1 min-h-[280px] lg:min-h-[320px]" : "min-h-[260px]",
            ].join(" ")}
          >
            <div className="relative flex-1 min-h-[180px] bg-muted">
              {img ? (
                <Image
                  src={img}
                  alt=""
                  fill
                  className="object-cover transition duration-500 group-hover:scale-[1.02]"
                  sizes={large ? "(max-width: 1024px) 100vw, 66vw" : "(max-width: 640px) 100vw, 33vw"}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-background" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl text-balance group-hover:underline decoration-primary/40 underline-offset-4">
                      {row.title}
                    </h2>
                    {row.tagline ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.tagline}</p>
                    ) : null}
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm ring-1 ring-border/60 opacity-90 transition group-hover:opacity-100">
                    <ArrowUpRight className="h-5 w-5" aria-hidden />
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border/60 bg-card px-5 py-4">
              <Avatar className="h-9 w-9 border border-border/60">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="text-xs font-medium">{ownerName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Collection by</p>
                <p className="truncate text-sm font-medium text-foreground">{ownerName}</p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
