import Link from "next/link"
import { notFound } from "next/navigation"

import { CoastalListingChoice } from "@/components/features/admin/coastal-delivery/coastal-listing-choice"
import { getCoastalPreviewPage } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Coastal delivery preview — Admin — Reswell",
  description: "Preview white-glove coastal delivery on a surfboard listing.",
  path: "/admin/coastal-delivery/preview",
})

export default async function CoastalDeliveryPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; listing?: string }>
}) {
  const params = await searchParams
  const loaded = await getCoastalPreviewPage({
    query: params.q ?? "",
    listingId: params.listing ?? "",
  })
  if (!loaded.ok) notFound()

  const { query, listings, listing, listingMissing, choice, stops, initialMatch } = loaded.data

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Listing preview</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Choose white-glove hand delivery on a surfboard listing, pick a drop-off, and see which
          shipper runs cover it. This does not appear on the public listing or in checkout.
        </p>
        <form action="/admin/coastal-delivery/preview" method="get" className="flex max-w-xl flex-col gap-2 sm:flex-row">
          <Input name="q" defaultValue={query} placeholder="Search by title or paste a listing id" />
          <Button type="submit">Search</Button>
        </form>
        {listings.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {query ? "No surfboard listings match that search." : "No surfboard listings to preview yet."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {listings.map((hit) => {
              const href = `/admin/coastal-delivery/preview?listing=${hit.id}${query ? `&q=${encodeURIComponent(query)}` : ""}`
              const place = [hit.city, hit.state].filter(Boolean).join(", ")
              return (
                <li key={hit.id}>
                  <Link href={href} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted">
                    <span>{hit.title}</span>
                    <span className="text-muted-foreground">
                      {place || "No city"} · {hit.status}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {listingMissing ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          That listing is not a surfboard we can preview.
        </p>
      ) : null}
      {listing ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">{listing.title}</h2>
          <p className="text-sm text-muted-foreground">
            {[listing.city, listing.state].filter(Boolean).join(", ") || "No seller city on the listing"} ·{" "}
            {listing.status}
          </p>
          <CoastalListingChoice
            key={listing.id}
            listing={listing}
            stops={stops}
            choice={choice}
            initialMatch={initialMatch}
          />
        </section>
      ) : null}
    </div>
  )
}
