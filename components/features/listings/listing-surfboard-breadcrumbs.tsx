import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { surfboardsBrowseRootLabel } from "@/lib/site-category-directory"

const crumbClass = "transition-colors hover:text-foreground"
const pageClass = "max-w-[min(100%,28rem)] truncate font-normal text-muted-foreground"

function CrumbLink({ href, children }: { href: string; children: string }) {
  return (
    <BreadcrumbItem>
      <BreadcrumbLink asChild className={crumbClass}>
        <Link href={href}>{children}</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
  )
}

function CrumbText({ children }: { children: string }) {
  return (
    <BreadcrumbItem>
      <span className={pageClass}>{children}</span>
    </BreadcrumbItem>
  )
}

function CrumbCurrent({ children }: { children: string }) {
  return (
    <BreadcrumbItem>
      <BreadcrumbPage className={pageClass}>{children}</BreadcrumbPage>
    </BreadcrumbItem>
  )
}

export function ListingSurfboardBreadcrumbs({
  brandName,
  brandHref,
  modelName,
  modelHref,
  listingTitle,
}: {
  brandName: string | null
  brandHref: string | null
  modelName: string | null
  modelHref: string | null
  listingTitle: string
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-1 text-[13px] font-normal tracking-wide text-muted-foreground sm:gap-1.5 sm:text-[14px]">
        <CrumbLink href="/">Home</CrumbLink>
        <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
        <CrumbLink href="/boards">{surfboardsBrowseRootLabel}</CrumbLink>
        {brandName ? (
          <>
            <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
            {brandHref ? <CrumbLink href={brandHref}>{brandName}</CrumbLink> : <CrumbText>{brandName}</CrumbText>}
          </>
        ) : null}
        {modelName ? (
          <>
            <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
            {modelHref ? <CrumbLink href={modelHref}>{modelName}</CrumbLink> : <CrumbCurrent>{modelName}</CrumbCurrent>}
          </>
        ) : (
          <>
            <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
            <CrumbCurrent>{listingTitle}</CrumbCurrent>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
