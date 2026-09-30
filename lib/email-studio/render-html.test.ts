import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { emailStudioDocumentSchema } from "../validations/emailStudio"
import { hydrateEmailStudioProductSnapshots } from "../services/emailStudioProducts"
import type {
  EmailStudioDocument,
  EmailStudioProductSnapshot,
} from "../types/emailStudio"
import { cloneEmailDocument, starterById } from "./document"
import { validateEmailStudioPreflight } from "./preflight"
import { isEmailStudioPublishComplete } from "./publish-result"
import {
  neutralizeKlaviyoLiquidData,
  renderEmailStudioHtml,
  renderEmailStudioText,
  resolveEmailStudioHtml,
  safeEmailHref,
  withEmailPreviewData,
  withEmailPreviewSamples,
} from "./render-html"

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

  it("fills every foundation event field in sample previews", () => {
    const source = [
      "{{ event|lookup:'image_url'|default:'' }}",
      "{{ event|lookup:'price_label'|default:'' }}",
      "{{ event|lookup:'seller_payout'|default:'' }}",
      "{{ event|lookup:'carrier'|default:'' }}",
      "{{ event|lookup:'tracking_number'|default:'' }}",
      "{{ event|lookup:'tracking_url'|default:'' }}",
      "{{ event|lookup:'review_url'|default:'' }}",
    ].join(" | ")
    const preview = withEmailPreviewSamples(source)

    assert.doesNotMatch(preview, /\{\{\s*event\|lookup:/)
    assert.match(preview, /opengraph-image\.jpg/)
    assert.match(preview, /\$640 · Excellent condition/)
    assert.match(preview, /\$576/)
    assert.match(preview, /UPS/)
    assert.match(preview, /1Z999AA10123456784/)
    assert.match(preview, /ups\.com\/track/)
    assert.match(preview, /dashboard\/purchases/)
  })

  it("uses a valid static fallback for the shipping tracking link", () => {
    const starter = starterById("shipping-update")
    assert.ok(starter)
    const html = renderEmailStudioHtml({
      name: starter.name,
      subject: starter.subject,
      previewText: starter.previewText,
      flowName: "",
      triggerMetric: starter.triggerMetric,
      document: cloneEmailDocument(starter.document),
    })

    assert.match(
      html,
      /\{\{ event\|lookup:'tracking_url'\|default:'https:\/\/www\.reswell\.app\/dashboard\/purchases' \}\}/,
    )
    assert.doesNotMatch(html, /default:event\.order_url/)
    assert.match(withEmailPreviewSamples(html), /https:\/\/www\.ups\.com\/track\?tracknum=/)
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

  it("keeps the default button markup until a style is set", () => {
    const html = renderEmailStudioHtml({
      name: "Button",
      subject: "",
      previewText: "",
      flowName: "",
      triggerMetric: "",
      document: {
        blocks: [
          {
            id: "00000000-0000-4000-8000-000000000021",
            type: "button",
            label: "Open",
            href: "https://www.reswell.app",
            align: "center",
          },
        ],
      },
    })
    assert.match(html, /bgcolor="#5574AD"/)
    assert.match(html, /font-size:16px/)
    assert.match(html, /font-weight:600/)
    assert.match(html, /border-radius:8px/)
    assert.doesNotMatch(html, /role="presentation" width="100%"/)
    assert.doesNotMatch(html, /class="hide-mobile"/)
  })

  it("paints button, image, and row styles when they are set", () => {
    const html = renderEmailStudioHtml({
      name: "Styled",
      subject: "",
      previewText: "",
      flowName: "",
      triggerMetric: "",
      document: {
        blocks: [
          {
            id: "00000000-0000-4000-8000-000000000031",
            type: "section",
            surface: "white",
            padding: "compact",
            gap: "compact",
            stackOnMobile: false,
            backgroundColor: "#111111",
            contentBackgroundColor: "#f7f6f2",
            borderWidth: 2,
            borderColor: "#e3ddd1",
            columns: [
              {
                id: "00000000-0000-4000-8000-000000000032",
                width: 1,
                blocks: [
                  {
                    id: "00000000-0000-4000-8000-000000000033",
                    type: "button",
                    label: "Try it",
                    href: "https://www.reswell.app",
                    align: "left",
                    fullWidth: true,
                    fontSize: 18,
                    fontWeight: "bold",
                    backgroundColor: "#101112",
                    textColor: "#f7f6f2",
                    radius: 24,
                  },
                  {
                    id: "00000000-0000-4000-8000-000000000034",
                    type: "image",
                    src: "https://www.reswell.app/images/reswell-logo.png",
                    alt: "Reswell",
                    href: "",
                    radius: 0,
                    hideOn: "mobile",
                    padding: { top: 20, right: 0, bottom: 40, left: 0 },
                  },
                ],
              },
            ],
          },
        ],
      },
    })
    assert.match(html, /bgcolor="#111111"/)
    assert.match(html, /background:#f7f6f2/)
    assert.match(html, /border:2px solid #e3ddd1/)
    assert.match(html, /bgcolor="#101112"/)
    assert.match(html, /color:#f7f6f2/)
    assert.match(html, /font-size:18px/)
    assert.match(html, /font-weight:700/)
    assert.match(html, /border-radius:24px/)
    assert.match(html, /role="presentation" width="100%"/)
    assert.match(html, /border-radius:0px/)
    assert.match(html, /class="hide-mobile"/)
    assert.match(html, /padding:20px 0px 40px 0px/)
    const parsed = emailStudioDocumentSchema.safeParse({
      blocks: [
        {
          id: "00000000-0000-4000-8000-000000000031",
          type: "section",
          surface: "white",
          padding: "compact",
          gap: "compact",
          stackOnMobile: false,
          backgroundColor: "#111111",
          contentBackgroundColor: "#f7f6f2",
          borderWidth: 2,
          borderColor: "#e3ddd1",
          columns: [
            {
              id: "00000000-0000-4000-8000-000000000032",
              width: 1,
              blocks: [
                {
                  id: "00000000-0000-4000-8000-000000000033",
                  type: "button",
                  label: "Try it",
                  href: "https://www.reswell.app",
                  align: "left",
                  fullWidth: true,
                  fontSize: 18,
                  fontWeight: "bold",
                  backgroundColor: "#101112",
                  textColor: "#f7f6f2",
                  radius: 24,
                },
              ],
            },
          ],
        },
      ],
    })
    assert.equal(parsed.success, true)
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

  it("treats every listing snapshot field as data instead of Liquid", () => {
    const tokenVariants = [
      "{{ profile.email }}",
      "{% comment %}",
      "{{- profile.email -}}",
      "{%- comment -%}",
      "stray }}",
      "stray %}",
      "{{{ overlapping }}}",
    ]
    for (const value of tokenVariants) {
      assert.doesNotMatch(neutralizeKlaviyoLiquidData(value), /\{\{|\}\}|\{%|%\}/)
    }

    const document: EmailStudioDocument = {
      blocks: [{
        id: "00000000-0000-4000-8000-000000000025",
        type: "product",
        title: "Featured listing",
        listingIds: ["00000000-0000-4000-8000-000000000026"],
        items: [{
          id: "00000000-0000-4000-8000-000000000026",
          title: "Board {{ profile.email }}",
          priceDisplay: "$500 {% assign altered = true %}",
          condition: "Good {{- profile.first_name -}}",
          dimensions: "6'0 {%- comment -%}hidden{%- endcomment -%}",
          boardType: "Fish }} %}",
          imageUrl: "https://images.example.com/{{ event.id }}.jpg",
          productUrl: "https://www.reswell.app/l/{% include 'listing' %}",
          availability: "available",
        }],
        showPrice: true,
        showCondition: true,
        showDimensions: true,
        showBoardType: true,
        showAvailability: true,
        ctaLabel: "View board",
      }],
    }
    const input = {
      name: "Untrusted listing data",
      subject: "",
      previewText: "",
      flowName: "",
      triggerMetric: "",
      document,
    }
    const html = renderEmailStudioHtml(input)
    const text = renderEmailStudioText(input)

    assert.doesNotMatch(html, /\{\{|\{%/)
    assert.doesNotMatch(text, /\{\{|\}\}|\{%|%\}/)
    assert.match(html, /Board ｛｛ profile\.email ｝｝/)
    assert.match(html, /images\.example\.com\/｛｛ event\.id ｝｝\.jpg/)
    assert.match(html, /www\.reswell\.app\/l\/｛% include/)
    assert.match(text, /Fish ｝｝ %｝/)
  })

  it("blocks malformed variables, unsafe links, and missing unsubscribe content", () => {
    const issues = validateEmailStudioPreflight({
      subject: "A board for {{ first_name",
      previewText: "",
      document: {
        blocks: [{
          id: "00000000-0000-4000-8000-000000000030",
          type: "button",
          label: "View board",
          href: "javascript:alert(1)",
          align: "left",
        }],
      },
    })
    assert.ok(issues.some((issue) => issue.code === "malformed-variable" && issue.severity === "error"))
    assert.ok(issues.some((issue) => issue.code === "invalid-link" && issue.severity === "error"))
    assert.ok(issues.some((issue) => issue.code === "missing-footer" && issue.severity === "error"))
    assert.ok(issues.some((issue) => issue.code === "missing-preview-text" && issue.severity === "warning"))
  })

  it("keeps every product block hydrated across the document", () => {
    const ids = Array.from(
      { length: 6 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    )
    const snapshot = (id: string): EmailStudioProductSnapshot => ({
      id,
      title: `Board ${id.slice(-1)}`,
      priceDisplay: "$500",
      condition: "Good",
      dimensions: "6'0″ × 20″ × 2.5″",
      boardType: "Shortboard",
      imageUrl: "https://www.reswell.app/board.jpg",
      productUrl: `https://www.reswell.app/l/${id}`,
      availability: "available",
    })
    const productBlock = (id: string, listingIds: string[]) => ({
      id,
      type: "product" as const,
      title: "Boards",
      listingIds,
      items: [],
      showPrice: true,
      showCondition: true,
      showDimensions: true,
      showBoardType: true,
      showAvailability: true,
      ctaLabel: "View board",
    })
    const document: EmailStudioDocument = {
      blocks: [
        productBlock("00000000-0000-4000-8000-000000000101", ids.slice(0, 3)),
        productBlock("00000000-0000-4000-8000-000000000102", ids.slice(3)),
      ],
    }

    const hydrated = hydrateEmailStudioProductSnapshots(document, ids.map(snapshot))
    const hydratedIds = hydrated.blocks.flatMap((block) => (
      block.type === "product" ? block.items.map((item) => item.id) : []
    ))

    assert.deepEqual(hydratedIds, ids)
  })

  it("ships the listing spotlight starter without preflight errors", () => {
    const starter = starterById("listing-spotlight")
    assert.ok(starter)
    const errors = validateEmailStudioPreflight({
      subject: starter.subject,
      previewText: starter.previewText,
      document: starter.document,
    }).filter((issue) => issue.severity === "error")

    assert.deepEqual(errors, [])
  })

  it("treats verification warnings as completed publishes", () => {
    assert.equal(isEmailStudioPublishComplete({ status: "success", message: "Published" }), true)
    assert.equal(isEmailStudioPublishComplete({ status: "warning", message: "Verification pending" }), true)
    assert.equal(isEmailStudioPublishComplete({ status: "error", message: "Failed" }), false)
  })
})