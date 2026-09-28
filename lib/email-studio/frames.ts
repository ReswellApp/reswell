import type {
  EmailAlign,
  EmailBlock,
  EmailButtonBlock,
  EmailContentBlock,
  EmailDetailRow,
  EmailDetailsBlock,
  EmailEyebrowBlock,
  EmailFooterBlock,
  EmailHeadingBlock,
  EmailImageBlock,
  EmailLogoBlock,
  EmailSectionBlock,
  EmailSectionSurface,
  EmailSplitBlock,
  EmailStudioDocument,
  EmailTextBlock,
} from "@/lib/types/emailStudio"
import { emailStudioDocumentSchema } from "@/lib/validations/emailStudio"

const HOME = "https://www.reswell.app"
const LOGO = "https://www.reswell.app/images/reswell-logo.png"

export const EMAIL_DESIGN_LAYOUTS = ["announcement", "editorial", "transactional", "product"] as const
export type EmailDesignLayout = (typeof EMAIL_DESIGN_LAYOUTS)[number]

export const EMAIL_STUDIO_FRAMES = [
  { id: "hero", name: "Hero", blurb: "Kicker, headline, and a short line on a solid band" },
  { id: "editorial", name: "Editorial", blurb: "Photo beside a headline and one action" },
  { id: "features", name: "Three up", blurb: "Three short points in a row" },
  { id: "spotlight", name: "Spotlight", blurb: "Listing photo, copy, and a button" },
  { id: "receipt", name: "Receipt", blurb: "Labeled rows for an order or shipment" },
  { id: "closer", name: "Closer", blurb: "Dark band that ends on one link" },
  { id: "quote", name: "Quote", blurb: "One line on a quiet surface" },
] as const

export type EmailStudioFrameId = (typeof EMAIL_STUDIO_FRAMES)[number]["id"]

export interface EmailFrameCopy {
  eyebrow?: string
  heading?: string
  text?: string
  buttonLabel?: string
  buttonHref?: string
  align?: EmailAlign
  surface?: EmailSectionSurface
  imageSrc?: string
  imageAlt?: string
  title?: string
  quote?: string
  rows?: { label: string; value: string }[]
  points?: { heading: string; text: string }[]
}

export interface DesignedEmailCopy {
  layout: EmailDesignLayout
  eyebrow?: string
  heading: string
  body: string
  buttonLabel: string
  buttonHref: string
  rows?: { label: string; value: string }[]
  imageSrc?: string
  imageAlt?: string
  footerText?: string
}

const DEFAULT_ORDER_ROWS = [
  { label: "Order", value: "{{ event|lookup:'order_num' }}" },
  { label: "Item", value: "{{ event|lookup:'Title'|default:'' }}" },
  { label: "Total", value: "{{ event|lookup:'$value'|default:'' }}" },
]

function uid(): string {
  return crypto.randomUUID()
}

function textOr(value: string | undefined, fallback: string): string {
  return value === undefined ? fallback : value
}

export function isEmailStudioFrameId(value: string): value is EmailStudioFrameId {
  return EMAIL_STUDIO_FRAMES.some((frame) => frame.id === value)
}

export function inferEmailDesignLayout(copy: string): EmailDesignLayout {
  const hay = copy.toLowerCase()
  if (/\b(order|shipped|receipt|refund|tracking)\b/.test(hay)) return "transactional"
  if (/\b(listing|board|price|saved|favorite)\b/.test(hay)) return "product"
  if (/\b(story|guide|journal|editorial)\b/.test(hay)) return "editorial"
  return "announcement"
}

function logoBlock(): EmailLogoBlock {
  return {
    id: uid(),
    type: "logo",
    src: LOGO,
    alt: "Reswell",
    href: `${HOME}?utm_source=klaviyo&utm_medium=email&utm_content=logo`,
    width: 140,
  }
}

function footerBlock(text: string): EmailFooterBlock {
  return {
    id: uid(),
    type: "footer",
    text,
    showUnsubscribe: true,
  }
}

function eyebrowBlock(text: string, align: EmailAlign): EmailEyebrowBlock {
  return { id: uid(), type: "eyebrow", text, align }
}

function headingBlock(text: string, align: EmailAlign): EmailHeadingBlock {
  return { id: uid(), type: "heading", text, align }
}

function textBlock(text: string, align: EmailAlign): EmailTextBlock {
  return { id: uid(), type: "text", text, align }
}

function buttonBlock(label: string, href: string, align: EmailAlign): EmailButtonBlock {
  return { id: uid(), type: "button", label, href, align }
}

function imageBlock(src: string, alt: string, width: number): EmailImageBlock {
  return { id: uid(), type: "image", src, alt, href: "", width, height: null }
}

function section(input: {
  surface: EmailSectionSurface
  padding?: EmailSectionBlock["padding"]
  gap?: EmailSectionBlock["gap"]
  columns: EmailSectionBlock["columns"]
}): EmailSectionBlock {
  return {
    id: uid(),
    type: "section",
    surface: input.surface,
    padding: input.padding ?? "comfortable",
    gap: input.gap ?? "comfortable",
    stackOnMobile: true,
    columns: input.columns,
  }
}

function column(width: 1 | 2 | 3, blocks: EmailContentBlock[]): EmailSectionBlock["columns"][number] {
  return { id: uid(), width, blocks }
}

function proseSection(text: string, surface: EmailSectionSurface): EmailSectionBlock {
  return section({
    surface,
    columns: [column(1, [textBlock(text, "left")])],
  })
}

export function createEmailFrame(id: EmailStudioFrameId, copy: EmailFrameCopy = {}): EmailBlock {
  const align = copy.align ?? "left"
  if (id === "hero") {
    const blocks: EmailContentBlock[] = []
    const eyebrow = textOr(copy.eyebrow, "Reswell")
    if (eyebrow.trim()) blocks.push(eyebrowBlock(eyebrow, align))
    blocks.push(headingBlock(textOr(copy.heading, "A board worth opening"), align))
    const text = textOr(copy.text, "One idea, written the way you'd say it.")
    if (text.trim()) blocks.push(textBlock(text, align))
    const label = textOr(copy.buttonLabel, "")
    if (label.trim()) {
      blocks.push(buttonBlock(label, textOr(copy.buttonHref, HOME), align))
    }
    return section({
      surface: copy.surface ?? "dark",
      padding: "spacious",
      columns: [column(1, blocks)],
    })
  }
  if (id === "editorial") {
    const copyBlocks: EmailContentBlock[] = []
    const eyebrow = textOr(copy.eyebrow, "From Reswell")
    if (eyebrow.trim()) copyBlocks.push(eyebrowBlock(eyebrow, "left"))
    copyBlocks.push(headingBlock(textOr(copy.heading, "Still in the water"), "left"))
    copyBlocks.push(textBlock(textOr(copy.text, "A short story, then one place to go next."), "left"))
    const label = textOr(copy.buttonLabel, "Read on Reswell")
    if (label.trim()) copyBlocks.push(buttonBlock(label, textOr(copy.buttonHref, HOME), "left"))
    return section({
      surface: copy.surface ?? "white",
      padding: "comfortable",
      columns: [
        column(2, copyBlocks),
        column(1, [imageBlock(textOr(copy.imageSrc, ""), textOr(copy.imageAlt, "Photo"), 260)]),
      ],
    })
  }
  if (id === "features") {
    const points = (copy.points && copy.points.length > 0
      ? copy.points
      : [
          { heading: "Shop used", text: "Boards, wetsuits, and the gear around them." },
          { heading: "Sell a quiver", text: "List it once. Buyers come to you." },
          { heading: "Talk it through", text: "Message the seller before you commit." },
        ]
    ).slice(0, 3)
    while (points.length < 3) points.push({ heading: "Reswell", text: "Used surf gear, in one place." })
    return section({
      surface: copy.surface ?? "muted",
      padding: "comfortable",
      gap: "compact",
      columns: points.map((point) => column(1, [
        headingBlock(point.heading || "Reswell", "left"),
        textBlock(point.text || "A short point.", "left"),
      ])),
    })
  }
  if (id === "spotlight") {
    const block: EmailSplitBlock = {
      id: uid(),
      type: "split",
      imageSrc: textOr(copy.imageSrc, ""),
      imageAlt: textOr(copy.imageAlt, "Listing photo"),
      imageHref: "",
      imageWidth: 240,
      imageHeight: null,
      title: textOr(copy.title, textOr(copy.heading, "Listing title")),
      text: textOr(copy.text, "Price, condition, and a reason to open it."),
      buttonLabel: textOr(copy.buttonLabel, "View listing"),
      buttonHref: textOr(copy.buttonHref, HOME),
    }
    return block
  }
  if (id === "receipt") {
    const source = copy.rows && copy.rows.length > 0 ? copy.rows : DEFAULT_ORDER_ROWS
    const rows: EmailDetailRow[] = source.slice(0, 12).map((row) => ({
      id: uid(),
      label: row.label,
      value: row.value,
    }))
    const block: EmailDetailsBlock = {
      id: uid(),
      type: "details",
      title: textOr(copy.title, "Details"),
      rows,
    }
    return block
  }
  if (id === "quote") {
    return section({
      surface: copy.surface ?? "muted",
      padding: "spacious",
      columns: [column(1, [headingBlock(textOr(copy.quote, textOr(copy.heading, "Used surf gear, without the runaround.")), "center")])],
    })
  }
  const closerBlocks: EmailContentBlock[] = [
    headingBlock(textOr(copy.heading, "When you're ready"), "center"),
    textBlock(textOr(copy.text, "One link back to Reswell."), "center"),
    buttonBlock(textOr(copy.buttonLabel, "Open Reswell"), textOr(copy.buttonHref, HOME), "center"),
  ]
  return section({
    surface: "dark",
    padding: "spacious",
    columns: [column(1, closerBlocks)],
  })
}

function orderLike(copy: string): boolean {
  return /\b(order|shipped|receipt|refund|tracking)\b/i.test(copy)
}

export function composeDesignedEmail(input: DesignedEmailCopy): EmailStudioDocument {
  const heading = input.heading.trim() || "Hello"
  const body = input.body.trim() || "Open it on Reswell."
  const buttonLabel = input.buttonLabel.trim() || "Open Reswell"
  const buttonHref = input.buttonHref.trim() || HOME
  const eyebrow = input.eyebrow?.trim() ?? ""
  const footerText = input.footerText?.trim() || "Reswell — the marketplace for used surf gear."
  const blocks: EmailBlock[] = [logoBlock()]
  const providedRows = (input.rows ?? []).filter((row) => row.label.trim() || row.value.trim())

  if (input.layout === "editorial") {
    blocks.push(createEmailFrame("editorial", {
      eyebrow: eyebrow || "From Reswell",
      heading,
      text: body,
      buttonLabel,
      buttonHref,
      imageSrc: input.imageSrc,
      imageAlt: input.imageAlt,
    }))
    blocks.push(createEmailFrame("closer", {
      heading: "See it on Reswell",
      text: "The rest of the story lives on the site.",
      buttonLabel,
      buttonHref,
    }))
  } else if (input.layout === "product") {
    blocks.push(createEmailFrame("spotlight", {
      title: heading,
      text: body,
      buttonLabel,
      buttonHref,
      imageSrc: input.imageSrc,
      imageAlt: input.imageAlt || "Listing photo",
    }))
    blocks.push(createEmailFrame("quote", {
      quote: "Used surf gear, from someone who actually rode it.",
    }))
  } else if (input.layout === "transactional") {
    blocks.push(createEmailFrame("hero", {
      surface: "muted",
      align: "left",
      eyebrow: eyebrow || "Update",
      heading,
      text: body,
      buttonLabel: "",
    }))
    const rows = providedRows.length > 0
      ? providedRows
      : orderLike(`${heading} ${body}`)
        ? DEFAULT_ORDER_ROWS
        : []
    if (rows.length > 0) {
      blocks.push(createEmailFrame("receipt", { title: "Details", rows }))
    }
    blocks.push(createEmailFrame("closer", {
      heading: "Open the details",
      text: "Tracking, the listing, and messages stay on Reswell.",
      buttonLabel,
      buttonHref,
    }))
  } else {
    const short = body.length <= 220 && !body.includes("\n")
    blocks.push(createEmailFrame("hero", {
      surface: "dark",
      align: "center",
      eyebrow: eyebrow || "Reswell",
      heading,
      text: short ? body : "",
      buttonLabel: "",
    }))
    if (!short) blocks.push(proseSection(body, "white"))
    blocks.push(createEmailFrame("closer", { buttonLabel, buttonHref }))
  }

  blocks.push(footerBlock(footerText))
  return { blocks, htmlOverride: null }
}

export function designFlatEmailDocument(
  document: EmailStudioDocument,
  hints?: { layout?: EmailDesignLayout; subject?: string },
): EmailStudioDocument {
  if (document.htmlOverride?.trim()) return document
  if (document.blocks.some((block) => block.type === "section")) return document

  const heading = document.blocks.find((block) => block.type === "heading")
  const eyebrow = document.blocks.find((block) => block.type === "eyebrow")
  const texts = document.blocks.flatMap((block) => block.type === "text" ? [block.text] : [])
  const button = document.blocks.find((block) => block.type === "button")
  const details = document.blocks.find((block) => block.type === "details")
  const split = document.blocks.find((block) => block.type === "split")
  const image = document.blocks.find((block) => block.type === "image")
  const footer = document.blocks.find((block) => block.type === "footer")
  const body = texts.filter((line) => line.trim()).join("\n\n")
  const copy = [heading && heading.type === "heading" ? heading.text : "", body, hints?.subject ?? ""].join(" ")
  const layout = hints?.layout
    ?? (details ? "transactional" : split ? "product" : inferEmailDesignLayout(copy))

  const designed = composeDesignedEmail({
    layout,
    eyebrow: eyebrow && eyebrow.type === "eyebrow" ? eyebrow.text : "",
    heading: heading && heading.type === "heading" ? heading.text : hints?.subject || "Hello",
    body: body || (split && split.type === "split" ? split.text : "") || "Open it on Reswell.",
    buttonLabel: button && button.type === "button"
      ? button.label
      : split && split.type === "split"
        ? split.buttonLabel
        : "Open Reswell",
    buttonHref: button && button.type === "button"
      ? button.href
      : split && split.type === "split"
        ? split.buttonHref
        : HOME,
    rows: details && details.type === "details"
      ? details.rows.map((row) => ({ label: row.label, value: row.value }))
      : undefined,
    imageSrc: image && image.type === "image"
      ? image.src
      : split && split.type === "split"
        ? split.imageSrc
        : "",
    imageAlt: image && image.type === "image"
      ? image.alt
      : split && split.type === "split"
        ? split.imageAlt
        : "",
    footerText: footer && footer.type === "footer" ? footer.text : undefined,
  })
  const parsed = emailStudioDocumentSchema.safeParse(designed)
  return parsed.success ? parsed.data : document
}
