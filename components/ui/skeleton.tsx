import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

/** Wave shimmer placeholder — matches listing tile / PangoBooks-style loading. */
function ListingTileShimmer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('listing-tile-shimmer rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton, ListingTileShimmer }
