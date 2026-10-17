import { notFound } from "next/navigation"
import { ShopifyDashboardPreview } from "./preview"

export default async function ShopifyDashboardPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()
  const params = await searchParams
  const mode =
    params.mode === "empty" ||
    params.mode === "disconnected" ||
    params.mode === "reconnect"
      ? params.mode
      : "connected"
  return <ShopifyDashboardPreview mode={mode} />
}
