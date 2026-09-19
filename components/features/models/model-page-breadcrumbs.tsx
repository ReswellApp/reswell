import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { brandProductCategoryLabel, type BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { priceGuideBrowseHref, isPriceGuideCategorySlug } from "@/lib/price-guide/categories"

export function ModelPageBreadcrumbs({
  brandName,
  brandSlug,
  modelName,
  categorySlug,
}: {
  brandName: string
  brandSlug: string
  modelName: string
  categorySlug: BrandProductCategorySlug
}) {
  const categoryHref = isPriceGuideCategorySlug(categorySlug)
    ? priceGuideBrowseHref(categorySlug)
    : "/boards"
  const categoryLabel = brandProductCategoryLabel(categorySlug)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={categoryHref}>{categoryLabel}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`${BRANDS_BASE}/${brandSlug}`}>{brandName}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{modelName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
