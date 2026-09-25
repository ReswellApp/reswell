import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cloneEmailDocument, starterById } from "./document.ts"
import { renderEmailStudioHtml, resolveEmailStudioHtml, safeEmailHref } from "./render-html.ts"

describe("email studio html", () => {
  it("drops unsafe links and keeps Klaviyo tags", () => {
    assert.equal(safeEmailHref("javascript:alert(1)"), "")
    assert.equal(safeEmailHref("https://www.reswell.app/boards"), "https://www.reswell.app/boards")
    assert.equal(
      safeEmailHref("{{ event|lookup:'order_url' }}"),
      "{{ event|lookup:'order_url' }}",
    )
  })

  it("renders a buyer order starter as a table email", () => {
    const starter = starterById("buyer-order")
    assert.ok(starter)
    const html = renderEmailStudioHtml({
      name: "Buyer order",
      subject: starter.subject,
      previewText: starter.previewText,
      flowName: "Purchase Successful",
      triggerMetric: starter.triggerMetric,
      document: cloneEmailDocument(starter.document),
    })
    assert.match(html, /<!DOCTYPE html>/)
    assert.match(html, /max-width:560px/)
    assert.match(html, /\{% unsubscribe 'Unsubscribe' %\}/)
    assert.match(html, /event\|lookup:'order_num'/)
    assert.doesNotMatch(html, /<script/i)
    assert.match(html, /Trigger metric: Purchase Successful/)
    assert.match(html, /Stack Sans Headline/)
    assert.match(html, /stack-sans-text-latin\.woff2/)
    assert.match(html, /stack-sans-headline-latin\.woff2/)
    const custom = resolveEmailStudioHtml({
      name: "Buyer order",
      subject: starter.subject,
      previewText: starter.previewText,
      flowName: "Purchase Successful",
      triggerMetric: starter.triggerMetric,
      document: { ...cloneEmailDocument(starter.document), htmlOverride: "<p>Custom</p>" },
    })
    assert.equal(custom, "<p>Custom</p>")
  })

  it("writes blog storage images as absolute /media urls and honors crop size", () => {
    const html = renderEmailStudioHtml({
      name: "Image",
      subject: "",
      previewText: "",
      flowName: "",
      triggerMetric: "",
      document: {
        blocks: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            type: "image",
            src: "https://abc.supabase.co/storage/v1/object/public/blog-images/cms/photo.jpg?t=1",
            alt: "Board",
            href: "",
            width: 200,
            height: 120,
          },
        ],
      },
    })
    assert.match(html, /https:\/\/www\.reswell\.app\/media\/blog\/cms\/photo\.jpg/)
    assert.doesNotMatch(html, /supabase\.co/)
    assert.match(html, /width:200px/)
    assert.match(html, /height:120px/)
    assert.match(html, /object-fit:cover/)
  })

  it("maps custom html onto the palette and Stack Sans", () => {
    const html = resolveEmailStudioHtml({
      name: "Custom",
      subject: "",
      previewText: "",
      flowName: "",
      triggerMetric: "",
      document: {
        blocks: [],
        htmlOverride: '<p style="color:#FF0000;font-family:Comic Sans MS, cursive">Hi</p><p style="font-family:Stack Sans Headline, serif">Title</p>',
      },
    })
    assert.match(html, /font-family:"Stack Sans Text", Arial/)
    assert.match(html, /font-family:"Stack Sans Headline"/)
    assert.doesNotMatch(html, /Comic Sans/)
    assert.doesNotMatch(html, /#FF0000/i)
    assert.match(html, /#334155/)
  })
})