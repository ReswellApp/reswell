import { SurfboardBoxesContent } from "@/components/features/seller-resources/surfboard-boxes-content"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("seller-resources-surfboard-boxes")
}

export default function SurfboardBoxesPage() {
  return <SurfboardBoxesContent />
}
