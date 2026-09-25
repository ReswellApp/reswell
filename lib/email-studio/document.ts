import type {
  EmailAlign,
  EmailBlock,
  EmailBlockType,
  EmailButtonBlock,
  EmailDetailsBlock,
  EmailEyebrowBlock,
  EmailHeadingBlock,
  EmailStudioDocument,
  EmailTextBlock,
} from "@/lib/types/emailStudio"
import {
  KLAVIYO_EMAIL_COLORS,
} from "@/lib/klaviyo/email-brand-styles"

export const RESWELL_EMAIL_LOGO =
  "https://www.reswell.app/images/reswell-logo.png"

export const RESWELL_EMAIL_HOME = "https://www.reswell.app"

export function emailBlockId(): string {
  return crypto.randomUUID()
}

export function createEmailBlock(type: EmailBlockType): EmailBlock {
  const id = emailBlockId()
  switch (type) {
    case "logo":
      return {
        id,
        type,
        src: RESWELL_EMAIL_LOGO,
        alt: "Reswell",
        href: `${RESWELL_EMAIL_HOME}?utm_source=klaviyo&utm_medium=email&utm_content=logo`,
        width: 140,
      }
    case "eyebrow":
      return { id, type, text: "Reswell", align: "left" }
    case "heading":
      return { id, type, text: "Headline", align: "left" }
    case "text":
      return {
        id,
        type,
        text: "Hey {{ first_name|default:'there' }} — write the email in plain language. Merge tags stay as typed.",
        align: "left",
      }
    case "image":
      return { id, type, src: "", alt: "", href: "" }
    case "button":
      return {
        id,
        type,
        label: "Open Reswell",
        href: RESWELL_EMAIL_HOME,
        align: "center",
      }
    case "split":
      return {
        id,
        type,
        imageSrc: "",
        imageAlt: "",
        imageHref: "",
        title: "Listing title",
        text: "Price, condition, and a short reason to open it.",
        buttonLabel: "View listing",
        buttonHref: "{{ event|lookup:'listing_url'|default:'https://www.reswell.app' }}",
      }
    case "details":
      return {
        id,
        type,
        title: "Details",
        rows: [
          { id: emailBlockId(), label: "Order", value: "{{ event|lookup:'order_num' }}" },
          { id: emailBlockId(), label: "Total", value: "{{ event|lookup:'value' }}" },
        ],
      }
    case "divider":
      return { id, type }
    case "spacer":
      return { id, type, height: 24 }
    case "footer":
      return {
        id,
        type,
        text: "Reswell — the marketplace for used surf gear.",
        showUnsubscribe: true,
      }
  }
}

export function blankEmailDocument(): EmailStudioDocument {
  return {
    blocks: [
      createEmailBlock("logo"),
      createEmailBlock("heading"),
      createEmailBlock("text"),
      createEmailBlock("button"),
      createEmailBlock("footer"),
    ],
  }
}

export interface EmailStudioStarter {
  id: string
  name: string
  description: string
  subject: string
  previewText: string
  triggerMetric: string
  document: EmailStudioDocument
}

function eyebrow(text: string): EmailEyebrowBlock {
  return { id: emailBlockId(), type: "eyebrow", text, align: "left" }
}

function heading(text: string, align: EmailAlign = "left"): EmailHeadingBlock {
  return { id: emailBlockId(), type: "heading", text, align }
}

function paragraph(text: string, align: EmailAlign = "left"): EmailTextBlock {
  return { id: emailBlockId(), type: "text", text, align }
}

function button(label: string, href: string): EmailButtonBlock {
  return { id: emailBlockId(), type: "button", label, href, align: "center" }
}

function details(title: string, rows: EmailDetailsBlock["rows"]): EmailDetailsBlock {
  return { id: emailBlockId(), type: "details", title, rows }
}

function starter(partial: Omit<EmailStudioStarter, "document"> & { blocks: EmailBlock[] }): EmailStudioStarter {
  return {
    id: partial.id,
    name: partial.name,
    description: partial.description,
    subject: partial.subject,
    previewText: partial.previewText,
    triggerMetric: partial.triggerMetric,
    document: { blocks: partial.blocks },
  }
}

export const EMAIL_STUDIO_STARTERS: EmailStudioStarter[] = [
  starter({
    id: "blank",
    name: "Blank Reswell",
    description: "Logo, headline, body, button, and unsubscribe footer.",
    subject: "",
    previewText: "",
    triggerMetric: "",
    blocks: blankEmailDocument().blocks,
  }),
  starter({
    id: "buyer-order",
    name: "Buyer order",
    description: "Order confirmation layout with a details card.",
    subject: "Your Reswell order is confirmed",
    previewText: "We sent the seller your order details.",
    triggerMetric: "Purchase Successful",
    blocks: [
      createEmailBlock("logo"),
      eyebrow("Order confirmed"),
      heading("You're all set"),
      paragraph(
        "Hey {{ first_name|default:'there' }} — we received your order. The seller has what they need to get it to you.",
      ),
      details("Your order", [
        { id: emailBlockId(), label: "Order", value: "{{ event|lookup:'order_num' }}" },
        { id: emailBlockId(), label: "Board", value: "{{ event|lookup:'Title' }}" },
        { id: emailBlockId(), label: "Total", value: "{{ event|lookup:'$value' }}" },
      ]),
      button("View order", "{{ event|lookup:'order_url'|default:'https://www.reswell.app' }}"),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "listing-spotlight",
    name: "Listing spotlight",
    description: "Image beside copy for a saved board or price drop.",
    subject: "A board you saved just changed",
    previewText: "Open the listing before it's gone.",
    triggerMetric: "Favorite Price Drop",
    blocks: [
      createEmailBlock("logo"),
      heading("Still on your list"),
      paragraph("Hey {{ first_name|default:'there' }} — this one moved. Take another look."),
      createEmailBlock("split"),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "promo",
    name: "Campaign",
    description: "Full-width image, headline, and one button.",
    subject: "",
    previewText: "",
    triggerMetric: "Newsletter",
    blocks: [
      createEmailBlock("logo"),
      createEmailBlock("image"),
      heading("Campaign headline", "center"),
      paragraph("One idea, one link. Keep the copy short enough to read on a phone.", "center"),
      createEmailBlock("button"),
      createEmailBlock("footer"),
    ],
  }),
]

export function starterById(id: string): EmailStudioStarter | null {
  return EMAIL_STUDIO_STARTERS.find((item) => item.id === id) ?? null
}

export function cloneEmailDocument(document: EmailStudioDocument): EmailStudioDocument {
  return {
    blocks: document.blocks.map((block) => {
      if (block.type === "details") {
        return {
          ...block,
          id: emailBlockId(),
          rows: block.rows.map((row) => ({ ...row, id: emailBlockId() })),
        }
      }
      return { ...block, id: emailBlockId() }
    }),
  }
}

export const EMAIL_CANVAS_BG = KLAVIYO_EMAIL_COLORS.background
