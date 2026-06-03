import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type SellersBreadcrumbsProps = {
  /** Seller display name on profile pages; omit on the directory page. */
  sellerName?: string
  className?: string
}

export function SellersBreadcrumbs({ sellerName, className }: SellersBreadcrumbsProps) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="gap-1 text-[13px] font-normal tracking-wide text-muted-foreground sm:gap-1.5 sm:text-[14px]">
        <BreadcrumbItem>
          <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
            <Link href="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
        {sellerName ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                <Link href="/sellers">Sellers</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[min(100%,28rem)] truncate font-normal text-muted-foreground">
                {sellerName}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage className="font-normal text-muted-foreground">Sellers</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
