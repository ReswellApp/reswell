import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PublicOrderTrackingView } from "@/components/features/orders/public-order-tracking-view"
import { getPublicOrderTrackingPage } from "@/lib/services/publicOrderTracking"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type PageProps = { params: Promise<{ id: string }> }

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Track your package — Reswell",
    description: "Live carrier scans for your Reswell shipment.",
    path: `/track/${id}`,
  })
}

export default async function PublicOrderTrackingPage(props: PageProps) {
  const { id } = await props.params
  const orderId = id?.trim() ?? ""
  if (!ORDER_ID_RE.test(orderId)) notFound()

  const page = await getPublicOrderTrackingPage(orderId)
  if (!page) notFound()

  return <PublicOrderTrackingView page={page} />
}
