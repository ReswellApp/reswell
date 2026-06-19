import { notFound } from "next/navigation"
import Image from "next/image"
import QRCode from "qrcode"
import { getStoreHubContext } from "@/lib/store-hub-access"
import { ensureListingBarcode } from "@/lib/services/listingBarcode"
import { PrintButton } from "@/components/features/consignment/print-button"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export const dynamic = "force-dynamic"

export default async function StoreListingLabelPage({
  params,
}: {
  params: Promise<{ slug: string; listingId: string }>
}) {
  const { slug, listingId } = await params
  const { userId } = await getStoreHubContext(slug)
  const { description } = resolveStoreSectionMeta(
    `/stores/${slug}/inventory/${listingId}/label`,
    slug,
  )

  const result = await ensureListingBarcode({ staffProfileId: userId, listingId })
  if (!result.ok) {
    notFound()
  }

  const qrDataUrl = await QRCode.toDataURL(result.barcode, { width: 200, margin: 1 })

  return (
    <>
      <StorePageHeader title="Print label" description={description} />
      <div className="mx-auto max-w-sm rounded-lg border p-6 text-center print:border-0 print:p-0">
        <p className="text-sm font-medium">{result.title}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">${result.price.toFixed(2)}</p>
        <div className="mx-auto mt-4 w-fit rounded-lg border bg-white p-3">
          <Image src={qrDataUrl} alt="Barcode QR" width={200} height={200} unoptimized />
        </div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">{result.barcode}</p>
        <div className="mt-4 print:hidden">
          <PrintButton />
        </div>
      </div>
    </>
  )
}
