import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { fetchPublishedSurfCollectionBySlug, boardsSorted, type SurfCollectionListRow } from "@/lib/surf-collections"
import { getPublicSellerDisplayName, capitalizeWords } from "@/lib/listing-labels"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft } from "lucide-react"

export const revalidate = 120

function profileFromRow(row: SurfCollectionListRow) {
  const p = row.profiles
  if (Array.isArray(p)) return p[0] ?? null
  return p
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params
  const supabase = await createClient()
  const row = await fetchPublishedSurfCollectionBySlug(supabase, slug)
  if (!row) return { title: "Collection" }

  const title = capitalizeWords(row.title)
  const description =
    (row.tagline || row.intro || "Surfboard collection on Reswell.").slice(0, 180) || "Surfboard collection on Reswell."
  const boards = boardsSorted(row)
  const og =
    row.cover_image_url?.trim() ||
    boards[0]?.image_url?.trim() ||
    undefined

  return {
    title: `${title} · Collections`,
    description,
    openGraph: og ? { title, description, type: "website", images: [{ url: og }] } : { title, description, type: "website" },
    twitter: {
      card: og ? "summary_large_image" : "summary",
      title,
      description,
      images: og ? [og] : undefined,
    },
  }
}

export default async function SurfCollectionDetailPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const supabase = await createClient()
  const row = await fetchPublishedSurfCollectionBySlug(supabase, slug)
  if (!row) notFound()

  const profile = profileFromRow(row)
  const ownerName = getPublicSellerDisplayName(profile)
  const boards = boardsSorted(row)
  const hero =
    row.cover_image_url?.trim() ||
    boards[0]?.image_url?.trim() ||
    null

  return (
    <main className="flex-1">
      <section className="relative min-h-[42vh] w-full bg-muted">
        {hero ? (
          <>
            <Image
              src={hero}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted via-background to-muted" />
        )}

        <div className="relative mx-auto flex min-h-[42vh] max-w-6xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-28">
          <Link
            href="/collections"
            className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Collections
          </Link>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
            {row.title}
          </h1>
          {row.tagline ? (
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl text-pretty">{row.tagline}</p>
          ) : null}

          <div className="mt-8 flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-background shadow-md">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
              <AvatarFallback>{ownerName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Collection by</p>
              <p className="text-base font-semibold text-foreground">{ownerName}</p>
            </div>
          </div>
        </div>
      </section>

      {row.intro ? (
        <div className="border-b border-border/60 bg-muted/15">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
            <p className="text-base leading-relaxed text-foreground/90 sm:text-lg whitespace-pre-wrap">{row.intro}</p>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {boards.length === 0 ? (
          <p className="text-center text-muted-foreground">Board photos for this collection are on the way.</p>
        ) : (
          <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3 lg:gap-6 [column-fill:_balance]">
            {boards.map((b) => (
              <li key={b.id} className="mb-5 break-inside-avoid lg:mb-6">
                <figure className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                  <div className="relative aspect-[4/5] w-full bg-muted">
                    <Image
                      src={b.image_url}
                      alt={b.caption || "Surfboard"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  {b.caption ? (
                    <figcaption className="border-t border-border/40 px-4 py-3 text-sm text-muted-foreground leading-snug">
                      {b.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
