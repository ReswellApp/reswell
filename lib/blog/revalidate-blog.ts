import { revalidatePath } from "next/cache"

/** Bust `/blog` index, article pages, and generated share images after CMS writes. */
export function revalidateBlogPaths(slug?: string) {
  revalidatePath("/blog")
  revalidatePath("/blog", "layout")
  revalidatePath("/blog/[slug]", "page")
  revalidatePath("/blog/[slug]", "layout")
  if (slug?.trim()) {
    const path = `/blog/${slug.trim()}`
    revalidatePath(path)
    revalidatePath(`${path}/opengraph-image`)
    revalidatePath(`${path}/twitter-image`)
  }
}
