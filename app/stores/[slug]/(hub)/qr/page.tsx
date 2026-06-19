import Image from "next/image"
import QRCode from "qrcode"
import { getStoreHubContext } from "@/lib/store-hub-access"
import { ensureStoreIntakeToken } from "@/lib/services/consignmentStoreQr"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { PrintButton } from "@/components/features/consignment/print-button"
import { IntakeGateToggle } from "@/components/features/consignment/intake-gate-toggle"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export const dynamic = "force-dynamic"

export default async function StoreQrPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { store, role } = await getStoreHubContext(slug)
  const { description } = resolveStoreSectionMeta(`/stores/${slug}/qr`, slug)

  const tokenResult = await ensureStoreIntakeToken(store.id)
  if (!tokenResult.ok) {
    return (
      <>
        <StorePageHeader title="Intake QR" description={description} />
        <p className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          {tokenResult.error}
        </p>
      </>
    )
  }

  const consignUrl = `${publicSiteOrigin()}/stores/${slug}/consign?t=${tokenResult.token}`
  const qrDataUrl = await QRCode.toDataURL(consignUrl, { width: 512, margin: 1 })

  return (
    <>
      <StorePageHeader title="Intake QR" description={description} />

      <div className="mx-auto max-w-md">
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm print:border-0 print:shadow-none">
          <h2 className="text-xl font-semibold tracking-tight">Consign a board here</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Scan to list a board with {store.name}. You&apos;ll review it, set the price, and handle
            the sale.
          </p>

          <div className="mx-auto mt-6 w-fit rounded-lg border bg-white p-4">
            <Image src={qrDataUrl} alt="Intake QR code" width={256} height={256} unoptimized />
          </div>

          <p className="mt-4 break-all text-xs text-muted-foreground">{consignUrl}</p>
        </div>

        <div className="mt-6 flex justify-center print:hidden">
          <PrintButton label="Print QR sign" />
        </div>

        <div className="mt-6 print:hidden">
          {role === "owner" ? (
            <IntakeGateToggle storeId={store.id} requireIntakeToken={store.requireIntakeToken} />
          ) : (
            <p className="rounded-lg border p-4 text-center text-xs text-muted-foreground">
              {store.requireIntakeToken
                ? "Consignments are limited to people who scan this QR."
                : "Consignments are open to anyone with a Reswell account."}{" "}
              Only the store owner can change this.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
