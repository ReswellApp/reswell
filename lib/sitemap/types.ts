export type SitemapUrlEntry = {
  url: string
  lastModified: Date
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
  priority: number
  /** Absolute image URLs for the Google image sitemap extension. */
  images?: string[]
}
