import assert from "node:assert/strict"
import { describe, it } from "node:test"
// @ts-expect-error Node's type-stripping test runner requires the explicit extension.
import { cloneEmailDocument, starterById } from "./document.ts"
// @ts-expect-error Node's type-stripping test runner requires the explicit extension.
import {
  renderEmailStudioHtml,
  resolveEmailStudioHtml,
  safeEmailHref,
  withEmailPreviewData,
} from "./render-html.ts"
// @ts-expect-error Node's type-stripping test runner requires the explicit extension.
import { emailStudioDocumentSchema } from "../validations/emailStudio.ts"

describe("email studio html", () => {
  it("drops unsafe links and keeps Klaviyo tags", () => {
    assert.equal(safeEmailHref("javascript:alert(1)"), "")
    assert.equal(safeEmailHref("https://www.reswell.app/boards"), "https://www.reswell.app/boards")
    assert.equal(
      safeEmailHref("{{ event|lookup:'order_url' }}"),
      "{{ event|lookup:'order_url' }}",
    )
  })

  it("previews real profile and event values without changing pushed HTML", () => {
    const source = [
      "Hi {{ first_name|default:'there' }} {{ last_name|default:'' }}",
      "{{ email }}",
      "{{ event|lookup:'order_num' }}",
      "{{ event|lookup:'missing'|default:'Fallback' }}",
      "{{ event|lookup:'unsafe' }}",
    ].join(" | ")
    const preview = withEmailPreviewData(source, {
      profile: {
        firstName: "Kai",
        lastName: "Lenny",
        email: "kai@example.com",
      },
      event: {
        order_num: "RW-4200",
        unsafe: "<script>alert(1)</script>",
      },
    })
    assert.match(preview, /Hi Kai Lenny/)
    assert.match(preview, /kai@example\.com/)
    assert.match(preview, /RW-4200/)
    assert.match(preview, /Fallback/)
    assert.doesNotMatch(preview, /<script>/)
    assert.match(source, /\{\{ first_name/)
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

  it("renders email-safe responsive sections and columns", () => {
    const html = renderEmailStudioHtml({
      name: "Editorial",
      subject: "New boards",
      previewText: "",
      flowName: "",
      triggerMetric: "",
      document: {
        blocks: [
          {
            id: "00000000-0000-4000-8000-000000000010",
            type: "section",
            surface: "brand",
            padding: "spacious",
            gap: "comfortable",
            stackOnMobile: true,
            columns: [
              {
                id: "00000000-0000-4000-8000-000000000011",
                width: 2,
                blocks: [
                  {
                    id: "00000000-0000-4000-8000-000000000012",
                    type: "heading",
                    text: "Fresh finds",
                    align: "left",
                  },
                ],
              },
              {
                id: "00000000-0000-4000-8000-000000000013",
                width: 1,
                blocks: [
                  {
                    id: "00000000-0000-4000-8000-000000000014",
                    type: "text",
                    text: "Built for your next session.",
                    align: "left",
                  },
                ],
              },
            ],
          },
        ],
      },
    })
    assert.match(html, /class="stack"/)
    assert.match(html, /width:67%/)
    assert.match(html, /padding:32px/)
    assert.match(html, /max-width:600px/)
    assert.match(html, /color:#FFFFFF/i)
  })

  it("renders product-aware listing cards and enforces the four-listing cap", () => {
    const product = {
      id: "00000000-0000-4000-8000-000000000020",
      type: "product" as const,
      title: "Boards worth a look",
      listingIds: ["00000000-0000-4000-8000-000000000021"],
      items: [{
        id: "00000000-0000-4000-8000-000000000021",
        title: "6'2 Ghost",
        priceDisplay: "$640",
        condition: "Excellent",
        dimensions: "6'2″ × 19″ × 2 1/2″ · 30 L",
        boardType: "Shortboard",
        imageUrl: "https://www.reswell.app/board.jpg",
        productUrl: "https://www.reswell.app/l/ghost",
        availability: "available" as const,
      }],
      showPrice: true,
      showCondition: true,
      showDimensions: true,
      showBoardType: true,
      showAvailability: true,
      ctaLabel: "View board",
    }
    const document = { blocks: [product] }
    const parsed = emailStudioDocumentSchema.safeParse(document)
    assert.equal(parsed.success, true)

    const html = renderEmailStudioHtml({
      name: "Products",
      subject: "",
      previewText: "",
      flowName: "",
      triggerMetric: "",
      document,
    })
    assert.match(html, /Boards worth a look/)
    assert.match(html, /\$640/)
    assert.match(html, /Excellent/)
    assert.match(html, /Available/)
    assert.match(html, /https:\/\/www\.reswell\.app\/l\/ghost/)

    const tooMany = emailStudioDocumentSchema.safeParse({
      blocks: [{ ...product, listingIds: Array.from({ length: 5 }, (_, index) => `00000000-0000-4000-8000-00000000002${index}`) }],
    })
    assert.equal(tooMany.success, false)
  })
})