import Image from "next/image"
import { wideShimmer } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"

const PHOTO_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px"

type PackingPhoto = {
  src: string
  alt: string
  caption: string
  portrait?: boolean
  className?: string
}

const PACKING_PHOTOS: readonly PackingPhoto[] = [
  {
    src: "/images/seller-resources/how-to-ship/rail-tape.jpg",
    alt: "Gloved hands pressing protective tape onto the rail of a black surfboard",
    caption: "Tape the rails before the board goes in.",
    portrait: true,
  },
  {
    src: "/images/seller-resources/how-to-ship/carton-blanks.jpg",
    alt: "Stacks of flat die-cut cardboard surfboard boxes",
    caption: "Flat cartons, ready to fold around a board.",
    portrait: true,
  },
  {
    src: "/images/seller-resources/how-to-ship/honeycomb-interior.jpg",
    alt: "Open surfboard box lined with honeycomb cardboard, seen from one end on a wood floor",
    caption: "Honeycomb fill lines the carton.",
  },
  {
    src: "/images/seller-resources/how-to-ship/carton-blanks-rows.jpg",
    alt: "Rows of die-cut cardboard box edges stacked in a workshop",
    caption: "Die-cut edges on the blanks.",
  },
  {
    src: "/images/seller-resources/how-to-ship/honeycomb-closeup.jpg",
    alt: "Close-up of brown honeycomb cardboard cells",
    caption: "A closer look at the honeycomb cells.",
  },
  {
    src: "/images/seller-resources/how-to-ship/fragile-labels.jpg",
    alt: "A hand holding a roll of red Fragile and Handle with Care labels, with surfboards behind",
    caption: "Label the box before the carrier takes it.",
  },
  {
    src: "/images/seller-resources/how-to-ship/carton-blanks-wall.jpg",
    alt: "Tall stacks of flat cardboard surfboard boxes against a wall",
    caption: "Cartons stacked in the shop.",
    portrait: true,
  },
  {
    src: "/images/seller-resources/how-to-ship/packed-boxes.jpg",
    alt: "Long surfboard boxes with red Fragile labels lined up on the floor of a shipping store",
    caption: "Labeled cartons ready to drop off.",
    portrait: true,
  },
  {
    src: "/images/seller-resources/how-to-ship/sleeve-full.jpg",
    alt: "A surfboard wrapped in a honeycomb cardboard sleeve, lying in front of a garage door",
    caption: "A honeycomb sleeve over the whole board.",
  },
  {
    src: "/images/seller-resources/how-to-ship/sleeve-closeup.jpg",
    alt: "Close-up of a honeycomb cardboard sleeve over a white surfboard deck",
    caption: "The sleeve sits on the deck.",
  },
  {
    src: "/images/seller-resources/how-to-ship/sleeve-nose.jpg",
    alt: "The nose of a surfboard covered by a honeycomb cardboard sleeve",
    caption: "It follows the outline of the nose.",
    portrait: true,
    className: "lg:col-span-2",
  },
  {
    src: "/images/seller-resources/how-to-ship/sleeve-band.jpg",
    alt: "A red surfboard in a honeycomb sleeve with a cardboard band, seen from above",
    caption: "A band holds the sleeve in place.",
    portrait: true,
    className: "lg:col-span-2",
  },
  {
    src: "/images/seller-resources/how-to-ship/boxes-outside.jpg",
    alt: "Two labeled surfboard boxes on a brick walkway outside a building",
    caption: "Boxed and labeled, ready to ship.",
    portrait: true,
    className: "sm:col-span-2 lg:col-span-2",
  },
]

export function HowToShipPackingPhotos() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start lg:grid-cols-6">
      {PACKING_PHOTOS.map((photo) => (
        <li key={photo.src} className={cn("lg:col-span-3", photo.className)}>
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
                sizes={PHOTO_SIZES}
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
