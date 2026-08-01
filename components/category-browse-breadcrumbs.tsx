import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { categoryBrowseHasDynamicParams } from "@/lib/utils/category-browse-breadcrumbs"

export type CategoryBrowseBreadcrumbSegment = {
  label: string
  /** Clean URL for this segment alone (e.g. `/boards?type=shortboard`). */
  href: string
  /** Param keys that define this segment — ignored when deciding if deeper filters are active. */
  ownedParamKeys: readonly string[]
}

type Props = {
  rootHref: string
  rootLabel: string
  segment?: CategoryBrowseBreadcrumbSegment
  searchParams: Record<string, string | string[] | undefined>
}

const linkClassName = "text-[#5c6b89] hover:text-[#4a5768]"
const pageClassName = "font-normal text-[#5c6b89]"
const separatorClassName = "text-[#5c6b89] [&>svg]:stroke-[1.25]"
const listClassName = "gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2"

/**
 * Category browse breadcrumbs. Parent crumbs become links whenever the URL has
 * query state under them (search, filters, sort, page > 1), so users can jump
 * back to the clean category / segment view.
 */
export function CategoryBrowseBreadcrumbs({
  rootHref,
  rootLabel,
  segment,
  searchParams,
}: Props) {
  const hasDeeperThanRoot = categoryBrowseHasDynamicParams(searchParams)
  const hasDeeperThanSegment = segment
    ? categoryBrowseHasDynamicParams(searchParams, segment.ownedParamKeys)
    : false

  return (
    <Breadcrumb>
      <BreadcrumbList className={listClassName}>
        <BreadcrumbItem>
          <BreadcrumbLink asChild className={linkClassName}>
            <Link href="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className={separatorClassName} />

        {segment ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild className={linkClassName}>
                <Link href={rootHref}>{rootLabel}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className={separatorClassName} />
            <BreadcrumbItem>
              {hasDeeperThanSegment ? (
                <BreadcrumbLink asChild className={linkClassName}>
                  <Link href={segment.href}>{segment.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className={pageClassName}>{segment.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        ) : hasDeeperThanRoot ? (
          <BreadcrumbItem>
            <BreadcrumbLink asChild className={linkClassName}>
              <Link href={rootHref}>{rootLabel}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage className={pageClassName}>{rootLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
