import Image from "next/image"
import { wideShimmer } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"

type PackingPhoto = {
  src: string
  alt: string
  caption: string
  portrait?: boolean
  className?: string
  sizes: string
}

const PACKING_PHOTOS: readonly PackingPhoto[] = [
  {
    src: "/images/seller-resources/how-to-ship/rail-tape.jpg",
    alt: "Gloved hands pressing protective tape onto the rail of a black surfboard",
    caption: "Tape the rails before the board goes in.",
    portrait: true,
    className: "lg:col-span-2",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px",
  },
  {
    src: "/images/seller-resources/how-to-ship/carton-blanks.jpg",
    alt: "Stacks of flat die-cut cardboard surfboard boxes",
    caption: "Flat cartons, ready to fold around a board.",
    portrait: true,
    className: "lg:col-span-2",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px",
  },
  {
    src: "/images/seller-resources/how-to-ship/carton-blanks-wall.jpg",
    alt: "Tall stacks of flat cardboard surfboard boxes against a wall",
    caption: "Cartons stacked in the shop.",
    portrait: true,
    className: "sm:col-span-2 lg:col-span-2",
    sizes: "(max-width: 1024px) 100vw, 380px",
  },
  {
    src: "/images/seller-resources/how-to-ship/honeycomb-interior.jpg",
    alt: "Open surfboard box lined with honeycomb cardboard, seen from one end on a wood floor",
    caption: "Honeycomb fill lines the carton.",
    className: "lg:col-span-3",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px",
  },
  {
    src: "/images/seller-resources/how-to-ship/carton-blanks-rows.jpg",
    alt: "Rows of die-cut cardboard box edges stacked in a workshop",
    caption: "Die-cut edges on the blanks.",
    className: "lg:col-span-3",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px",
  },
  {
    src: "/images/seller-resources/how-to-ship/honeycomb-closeup.jpg",
    alt: "Close-up of brown honeycomb cardboard cells",
    caption: "A closer look at the honeycomb cells.",
    className: "lg:col-span-3",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px",
  },
  {
    src: "/images/seller-resources/how-to-ship/fragile-labels.jpg",
    alt: "A hand holding a roll of red Fragile and Handle with Care labels, with surfboards behind",
    caption: "Label the box before the carrier takes it.",
    className: "lg:col-span-3",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px",
  },
]

export function HowToShipPackingPhotos() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start lg:grid-cols-6">
      {PACKING_PHOTOS.map((photo) => (
        <li key={photo.src} className={photo.className}>
          <figure>
            <div
              className={cn(
                "relative overflow-hidden rounded-[1.25rem] bg-muted sm:rounded-[1.75rem]",
                photo.portrait ? "aspect-[3/4]" : "aspect-[4/3]",
              )}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes={photo.sizes}
                quality={80}
                className="object-cover"
                placeholder="blur"
                blurDataURL={wideShimmer}
              />
            </div>
            <figcaption className="mt-2 text-sm leading-snug text-[#5c6b89]">
              {photo.caption}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  )
}
