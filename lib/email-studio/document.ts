import type {
  EmailBlock,
  EmailBlockType,
  EmailStudioDocument,
} from "@/lib/types/emailStudio"
import {
  KLAVIYO_EMAIL_COLORS,
} from "@/lib/klaviyo/email-brand-styles"
import { createEmailFrame } from "@/lib/email-studio/frames"

export const RESWELL_EMAIL_LOGO =
  "https://www.reswell.app/images/reswell-logo.png"

export const RESWELL_EMAIL_HOME = "https://www.reswell.app"

export function emailBlockId(): string {
  return crypto.randomUUID()
}

export function createEmailBlock(type: EmailBlockType): EmailBlock {
  const id = emailBlockId()
  switch (type) {
    case "section":
      return {
        id,
        type,
        surface: "muted",
        padding: "comfortable",
        gap: "comfortable",
        stackOnMobile: true,
        columns: [
          {
            id: emailBlockId(),
            width: 1,
            blocks: [
              { id: emailBlockId(), type: "heading", text: "Section headline", align: "left" },
              { id: emailBlockId(), type: "text", text: "Add focused copy for this section.", align: "left" },
              {
                id: emailBlockId(),
                type: "button",
                label: "Open Reswell",
                href: RESWELL_EMAIL_HOME,
                align: "left",
              },
            ],
          },
        ],
      }
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
      return { id, type, src: "", alt: "", href: "", width: 560, height: null }
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
        imageWidth: 240,
        imageHeight: null,
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
    description: "Muted hero, an order receipt, and a closer.",
    subject: "Your Reswell order is confirmed",
    previewText: "We sent the seller your order details.",
    triggerMetric: "Purchase Successful",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("hero", {
        surface: "muted",
        align: "left",
        eyebrow: "Order confirmed",
        heading: "You're all set",
        text: "Hey {{ first_name|default:'there' }} — we received your order. The seller has what they need to get it to you.",
        buttonLabel: "",
      }),
      createEmailFrame("receipt", {
        title: "Your order",
        rows: [
          { label: "Order", value: "{{ event|lookup:'order_num' }}" },
          { label: "Board", value: "{{ event|lookup:'Title' }}" },
          { label: "Total", value: "{{ event|lookup:'$value' }}" },
        ],
      }),
      createEmailFrame("closer", {
        heading: "View the order",
        text: "Messages and tracking stay on Reswell.",
        buttonLabel: "View order",
        buttonHref: "{{ event|lookup:'order_url'|default:'https://www.reswell.app' }}",
      }),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "listing-spotlight",
    name: "Listing spotlight",
    description: "Listing spotlight with a photo, the price line, and one button.",
    subject: "A board you saved just changed",
    previewText: "Open the listing before it's gone.",
    triggerMetric: "Favorite Price Drop",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("spotlight", {
        title: "Still on your list",
        text: "Hey {{ first_name|default:'there' }} — this one moved. Take another look.",
        buttonLabel: "View listing",
        buttonHref: "{{ event|lookup:'listing_url'|default:'https://www.reswell.app' }}",
      }),
      createEmailFrame("quote", { quote: "Open it before someone else does." }),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "promo",
    name: "Campaign",
    description: "Dark hero, three points, and a closer.",
    subject: "",
    previewText: "",
    triggerMetric: "Newsletter",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("hero", {
        surface: "dark",
        align: "center",
        eyebrow: "Reswell",
        heading: "Campaign headline",
        text: "One idea, short enough to read on a phone.",
        buttonLabel: "",
      }),
      createEmailFrame("features"),
      createEmailFrame("closer", {
        buttonLabel: "Open Reswell",
        buttonHref: "https://www.reswell.app",
      }),
      createEmailBlock("footer"),
    ],
  }),
]

export function starterById(id: string): EmailStudioStarter | null {
  return EMAIL_STUDIO_STARTERS.find((item) => item.id === id) ?? null
}

export function cloneEmailBlock(block: EmailBlock): EmailBlock {
  if (block.type === "section") {
    return {
      ...block,
      id: emailBlockId(),
      columns: block.columns.map((column) => ({
        ...column,
        id: emailBlockId(),
        blocks: column.blocks.map((child) => cloneEmailBlock(child) as typeof child),
      })),
    }
  }
  if (block.type === "details") {
    return {
      ...block,
      id: emailBlockId(),
      rows: block.rows.map((row) => ({ ...row, id: emailBlockId() })),
    }
  }
  return { ...block, id: emailBlockId() }
}

export function cloneEmailDocument(document: EmailStudioDocument): EmailStudioDocument {
  return {
    htmlOverride: document.htmlOverride ?? null,
    blocks: document.blocks.map(cloneEmailBlock),
  }
}

export const EMAIL_CANVAS_BG = KLAVIYO_EMAIL_COLORS.background
