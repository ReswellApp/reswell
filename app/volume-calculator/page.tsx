import { VolumeCalculatorPage } from "@/components/features/volume-calculator/volume-calculator-page"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("volume-calculator")
}

export default function VolumeCalculatorRoutePage() {
  return <VolumeCalculatorPage />
}
