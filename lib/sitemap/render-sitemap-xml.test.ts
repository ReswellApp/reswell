import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { renderUrlSetXml } from "./render-sitemap-xml.ts"
import type { SitemapUrlEntry } from "./types.ts"

describe("sitemap xml", () => {
  it("emits image locations only for rows that have a photo", () => {
    const entries: SitemapUrlEntry[] = [
      {
        url: "https://www.reswell.app/l/one",
        lastModified: new Date("2026-01-02T00:00:00.000Z"),
        changeFrequency: "daily",
        priority: 0.75,
        images: ["https://www.reswell.app/media/listings/one.jpg"],
      },
      {
        url: "https://www.reswell.app/l/two",
        lastModified: new Date("2026-01-02T00:00:00.000Z"),
        changeFrequency: "daily",
        priority: 0.75,
      },
    ]
    const xml = renderUrlSetXml(entries)
    assert.match(xml, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/)
    assert.match(xml, /<image:loc>https:\/\/www\.reswell\.app\/media\/listings\/one\.jpg<\/image:loc>/)
    assert.equal(xml.match(/<image:image>/g)?.length, 1)
  })
})
