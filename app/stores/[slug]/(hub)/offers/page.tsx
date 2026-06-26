import { getStoreHubContext } from "@/lib/store-hub-access"
import { listStoreOffers } from "@/lib/db/storeOffers"
import { StoreOfferCard } from "@/components/features/consignment/store-offer-card"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export const dynamic = "force-dynamic"

export default async function StoreOffersPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { store, role } = await getStoreHubContext(slug)
  const { description } = resolveStoreSectionMeta(`/stores/${slug}/offers`, slug)

  const canRespond = role === "owner" || role === "manager"
  const offers = await listStoreOffers(store.id)

  return (
    <>
      <StorePageHeader title="Shop offers" description={description} />

      {offers.length === 0 ? (
        <p className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          No open offers.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {offers.map((offer) => (
            <StoreOfferCard
              key={offer.offerId}
              storeId={store.id}
              offer={offer}
              canRespond={canRespond}
            />
          ))}
        </ul>
      )}
    </>
  )
}
