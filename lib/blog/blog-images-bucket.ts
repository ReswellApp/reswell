/** Public bucket for blog/CMS uploads (admins upload with JWT per storage RLS). */
export const BLOG_IMAGES_BUCKET = "blog-images" as const

/** Longest stored edge. Portrait and landscape keep their native ratio. */
export const BLOG_IMAGE_MAX_EDGE_PX = 3000
