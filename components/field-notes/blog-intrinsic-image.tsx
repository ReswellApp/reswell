import Image from "next/image"
import { cn } from "@/lib/utils"
import { blogImageShouldBypassOptimization } from "@/lib/blog/blog-media-proxy-url"

type Props = {
  src: string
  alt: string
  /** Pixel size of the file. When omitted, the browser uses the image’s intrinsic ratio. */
  width?: number
  height?: number
  priority?: boolean
  sizes?: string
  className?: string
}

const INTRINSIC =
  "mx-auto h-auto w-auto max-h-[min(85vh,56rem)] max-w-full object-contain"

function hasPixelSize(width: number | undefined, height: number | undefined): width is number {
  return typeof width === "number" && width > 0 && typeof height === "number" && height > 0
}

/**
 * Blog photo at the file’s true aspect ratio. Do not wrap in a fixed 16:9/16:10 crop box.
 */
export function BlogIntrinsicImage({ src, alt, width, height, priority, sizes, className }: Props) {
  const classNames = cn(INTRINSIC, className)

  if (hasPixelSize(width, height)) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        unoptimized={blogImageShouldBypassOptimization(src)}
        className={classNames}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/image requires width/height; unknown files must keep native ratio
    <img src={src} alt={alt} className={classNames} loading={priority ? "eager" : "lazy"} />
  )
}
