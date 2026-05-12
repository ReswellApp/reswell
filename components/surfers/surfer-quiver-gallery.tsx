import Image from "next/image"
import type { SurferQuiverItem } from "@/lib/surfers/parse-surfer-quiver-items"

/**
 * Portrait tile geometry matches listing tiles (`aspect-[3/4]`, `rounded-xl`, `object-cover`).
 * Optional title above the image; optional description below.
 */
export function SurferQuiverGallery({
  displayName,
  items,
}: {
  displayName: string
  items: SurferQuiverItem[] | null | undefined
}) {
  const list = (items ?? []).filter((it) => it.image_url.trim())
  if (list.length === 0) return null

  return (
    <section className="border-b border-border/80 bg-background" aria-label="Quiver">
      <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <h2 className="mb-6 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Quiver</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((item, i) => {
            const alt = item.title?.trim() || `${displayName} — board ${i + 1}`
            return (
              <div key={`${item.image_url}-${i}`} className="flex flex-col gap-2">
                {item.title?.trim() ? (
                  <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {item.title.trim()}
                  </h3>
                ) : (
                  <span className="sr-only">{alt}</span>
                )}
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted">
                  <Image
                    src={item.image_url}
                    alt={alt}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    quality={88}
                  />
                </div>
                {item.description?.trim() ? (
                  <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
                    {item.description.trim()}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
