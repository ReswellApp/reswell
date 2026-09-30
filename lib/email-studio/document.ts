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
    case "product":
      return {
        id,
        type,
        title: "Featured boards",
        listingIds: [],
        items: [],
        showPrice: true,
        showCondition: true,
        showDimensions: true,
        showBoardType: true,
        showAvailability: true,
        ctaLabel: "View board",
      }
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
    previewText: "Here are the latest listing details.",
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
    name: "New arrivals campaign",
    description: "A focused announcement for fresh boards or a category drop.",
    subject: "Fresh boards, recently listed",
    previewText: "See what just landed on Reswell.",
    triggerMetric: "Newsletter",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("hero", {
        surface: "dark",
        align: "center",
        eyebrow: "Recently listed",
        heading: "Fresh boards worth a look",
        text: "A short edit of recently listed boards, ready when you are.",
        buttonLabel: "",
      }),
      createEmailFrame("features", {
        points: [
          { heading: "Shortboards", text: "Daily drivers, step-ups, and boards built for better waves." },
          { heading: "Mid-lengths", text: "More rail, more glide, and options for everyday surf." },
          { heading: "Longboards", text: "Logs, performance shapes, and everything between." },
        ],
      }),
      createEmailFrame("closer", {
        heading: "See what is new",
        text: "Browse the latest listings from surfers nationwide.",
        buttonLabel: "Browse new listings",
        buttonHref: "https://www.reswell.app/search/recent",
      }),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "welcome",
    name: "Welcome to Reswell",
    description: "A concise introduction to buying, selling, and trust on Reswell.",
    subject: "Welcome to Reswell",
    previewText: "A better place to buy and sell surfboards.",
    triggerMetric: "New Account Created",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("hero", {
        surface: "dark",
        align: "left",
        eyebrow: "Welcome",
        heading: "The board you want is not always in your town",
        text: "Hey {{ first_name|default:'there' }} — Reswell connects surfers nationwide to buy and sell surfboards and surf gear.",
        buttonLabel: "",
      }),
      createEmailFrame("features", {
        points: [
          { heading: "Built for surfers", text: "A marketplace centered on boards and the people who ride them." },
          { heading: "Talk before you buy", text: "Message the seller and get the details that matter." },
          { heading: "Local or shipped", text: "Meet nearby or use shipping when the right board is farther away." },
        ],
      }),
      createEmailFrame("closer", {
        heading: "Start with the boards",
        text: "Browse what surfers have listed recently.",
        buttonLabel: "Browse surfboards",
        buttonHref: "https://www.reswell.app/boards",
      }),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "browse-reminder",
    name: "Browse reminder",
    description: "A calm follow-up featuring the listing someone recently viewed.",
    subject: "Still thinking about this board?",
    previewText: "The listing details are one click away.",
    triggerMetric: "Viewed Product",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("hero", {
        surface: "muted",
        align: "left",
        eyebrow: "Worth another look",
        heading: "Still thinking it over?",
        text: "Hey {{ first_name|default:'there' }} — here is the board you recently viewed.",
        buttonLabel: "",
      }),
      createEmailFrame("spotlight", {
        imageSrc: "{{ event|lookup:'image_url'|default:'' }}",
        imageAlt: "{{ event|lookup:'Title'|default:'Surfboard listing' }}",
        title: "{{ event|lookup:'Title'|default:'Recently viewed board' }}",
        text: "{{ event|lookup:'price_label'|default:'Open the listing for the latest price and details.' }}",
        buttonLabel: "View listing",
        buttonHref: "{{ event|lookup:'listing_url'|default:'https://www.reswell.app/boards' }}",
      }),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "seller-sale",
    name: "Seller sale confirmation",
    description: "The sale, buyer, fulfillment method, and next action for a seller.",
    subject: "Your board sold",
    previewText: "Here is what to do next.",
    triggerMetric: "Shipping Sale Received",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("hero", {
        surface: "muted",
        align: "left",
        eyebrow: "Sale confirmed",
        heading: "Your board sold",
        text: "Hey {{ first_name|default:'there' }} — the buyer checked out. Review the order and take the next fulfillment step.",
        buttonLabel: "",
      }),
      createEmailFrame("receipt", {
        title: "Sale details",
        rows: [
          { label: "Order", value: "{{ event|lookup:'order_num'|default:'' }}" },
          { label: "Board", value: "{{ event|lookup:'Title'|default:'' }}" },
          { label: "Your payout", value: "{{ event|lookup:'seller_payout'|default:'' }}" },
        ],
      }),
      createEmailFrame("closer", {
        heading: "Open the sale",
        text: "Shipping, buyer messages, and order details stay together on Reswell.",
        buttonLabel: "View sale",
        buttonHref: "{{ event|lookup:'order_url'|default:'https://www.reswell.app/dashboard/sales' }}",
      }),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "shipping-update",
    name: "Shipping update",
    description: "A reassuring delivery update with tracking and order details.",
    subject: "Your board is on the way",
    previewText: "Tracking is ready for your Reswell order.",
    triggerMetric: "Order Shipping Update",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("hero", {
        surface: "muted",
        align: "left",
        eyebrow: "Shipping update",
        heading: "Your board is on the way",
        text: "Hey {{ first_name|default:'there' }} — the carrier has your shipment. Follow its progress from the order page.",
        buttonLabel: "",
      }),
      createEmailFrame("receipt", {
        title: "Tracking",
        rows: [
          { label: "Order", value: "{{ event|lookup:'order_num'|default:'' }}" },
          { label: "Carrier", value: "{{ event|lookup:'carrier'|default:'' }}" },
          { label: "Tracking", value: "{{ event|lookup:'tracking_number'|default:'' }}" },
        ],
      }),
      createEmailFrame("closer", {
        heading: "Track the shipment",
        text: "The latest scan and seller messages are available on Reswell.",
        buttonLabel: "Track order",
        buttonHref: "{{ event|lookup:'tracking_url'|default:event.order_url|default:'https://www.reswell.app/dashboard/purchases' }}",
      }),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "review-request",
    name: "Review request",
    description: "A brief post-purchase request centered on marketplace trust.",
    subject: "How did the transaction go?",
    previewText: "Your review helps the next surfer buy with confidence.",
    triggerMetric: "Review Requested",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("hero", {
        surface: "white",
        align: "center",
        eyebrow: "One last step",
        heading: "How did it go?",
        text: "A short, honest review helps the next surfer know who they are dealing with.",
        buttonLabel: "",
      }),
      createEmailFrame("quote", {
        quote: "Trust gets stronger when surfers share the details.",
      }),
      createEmailFrame("closer", {
        heading: "Share your experience",
        text: "It only takes a minute.",
        buttonLabel: "Leave a review",
        buttonHref: "{{ event|lookup:'review_url'|default:'https://www.reswell.app/dashboard/purchases' }}",
      }),
      createEmailBlock("footer"),
    ],
  }),
  starter({
    id: "win-back",
    name: "Win-back",
    description: "A restrained re-engagement email for subscribers who have been away.",
    subject: "See what surfers have listed lately",
    previewText: "Fresh boards and used gear are waiting on Reswell.",
    triggerMetric: "User Inactive 30 Days",
    blocks: [
      createEmailBlock("logo"),
      createEmailFrame("hero", {
        surface: "dark",
        align: "left",
        eyebrow: "Back on Reswell",
        heading: "A lot can change in a month",
        text: "Hey {{ first_name|default:'there' }} — take a look at the boards and gear surfers have listed since your last visit.",
        buttonLabel: "",
      }),
      createEmailFrame("features", {
        points: [
          { heading: "Recently listed", text: "Start with the newest boards across the marketplace." },
          { heading: "Saved searches", text: "Return to the shapes, sizes, and brands you care about." },
          { heading: "Ready to sell?", text: "Make room in the rack by listing a board you are not riding." },
        ],
      }),
      createEmailFrame("closer", {
        heading: "See what changed",
        text: "Pick up where you left off.",
        buttonLabel: "Browse recent listings",
        buttonHref: "https://www.reswell.app/search/recent",
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
