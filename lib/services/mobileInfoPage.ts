import {
  MOBILE_INFO_PAGE_SLUGS,
  mobileInfoPageSchema,
  type MobileInfoPage,
  type MobileInfoPageSlug,
} from "@reswell/api-contract"
import {
  SANTA_BARBARA_DROPOFF_MAX_LENGTH,
  SANTA_BARBARA_DROPOFF_SHORTBOARD_MAX_WIDTH,
} from "@/lib/dropoff-santa-barbara"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"
import type { MobileApiResult } from "@/lib/services/mobileApi"

type InfoCard = Extract<MobileInfoPage["sections"][number], { kind: "cards" }>["cards"][number]

function isInfoSlug(slug: string): slug is MobileInfoPageSlug {
  return (MOBILE_INFO_PAGE_SLUGS as readonly string[]).includes(slug)
}

function card(
  title: string,
  body: string,
  extra?: Partial<Pick<InfoCard, "href" | "badge">>,
): InfoCard {
  return {
    title,
    body,
    screen: null,
    listing_id: null,
    image_url: null,
    href: extra?.href ?? null,
    badge: extra?.badge ?? null,
  }
}

function safety(): MobileInfoPage {
  return mobileInfoPageSchema.parse({
    slug: "safety",
    title: "Safety Tips",
    description: "How to buy and sell on Reswell without getting burned.",
    cta_label: "Message Reswell",
    cta_href: "/account/support",
    sections: [
      {
        kind: "paragraphs",
        title: "Stay safe on Reswell",
        paragraphs: [
          "Reswell runs on trust between buyers and sellers. These quick tips help keep you (and everyone else in the community) safe when you meet up, ship a board, or pay for one.",
        ],
      },
      {
        kind: "cards",
        title: "Tips",
        cards: [
          card(
            "Keep the conversation on Reswell",
            "Do your talking inside Reswell messages so we have a record of what was agreed. Try not to move to email or text for payment or pickup details until you know who you're dealing with.",
          ),
          card(
            "Meet somewhere public and well lit",
            "For local pickup, pick a busy, well lit spot like a coffee shop or a store parking lot. It's a good idea not to invite a stranger to your home, or go to theirs, on a first meetup.",
          ),
          card(
            "Inspect the item before you pay",
            "For surfboards, fins, wetsuits, and anything pricey, take a proper look in person before you hand over any money. Check for damage or wear that wasn't obvious in the listing photos.",
          ),
          card(
            "Pay through Reswell",
            "Paying through Reswell checkout (including with your wallet balance) keeps the sale on the platform and makes it easier for us to help if something goes sideways. Be careful with anyone who pushes you to pay outside the app.",
          ),
          card(
            "Trust your gut on red flags",
            "Be wary of deals that look too good to be true, sellers who pressure you to pay outside the app, or anyone who won't meet in person for a local pickup you already agreed on.",
          ),
        ],
      },
      {
        kind: "paragraphs",
        title: "If something looks wrong",
        paragraphs: [
          "If you spot something that breaks our guidelines or looks like a scam, send us a note through Reswell help or flag it in Messages.",
        ],
      },
    ],
  })
}

function protectionPolicy(): MobileInfoPage {
  return mobileInfoPageSchema.parse({
    slug: "protection-policy",
    title: "Purchase Protection",
    description:
      "Purchase Protection covers buyers on eligible purchases paid through Reswell checkout. Sellers are not charged an extra protection fee.",
    cta_label: "Get help",
    cta_href: "/account/support",
    sections: [
      {
        kind: "paragraphs",
        title: "Reswell Purchase Protection",
        paragraphs: [
          "Purchase Protection covers buyers on eligible purchases paid through Reswell checkout. This page also explains what sellers can expect — fair rules, no extra protection fees on your payouts, and how claims work when a buyer opens one.",
        ],
      },
      {
        kind: "cards",
        title: "Buyer protections",
        cards: [
          card(
            "Money back",
            "A full refund of the item price and shipping you paid for that purchase when a covered claim is approved.",
          ),
          card(
            "Covered problems",
            "Non-delivery, item not as described (material mismatch), or damage in transit with the required evidence.",
          ),
          card(
            "Returns when required",
            "For not-as-described and damage claims, we provide a prepaid return label. Your refund is released after the seller confirms receipt.",
          ),
        ],
      },
      {
        kind: "cards",
        title: "Seller protections",
        cards: [
          card(
            "No extra protection fee",
            "Reswell funds approved buyer refunds from our marketplace fee. Your agreed seller share is not reduced by a separate protection line item.",
          ),
          card(
            "Claims stay inside the policy",
            "Buyer's remorse, subjective expectations, and off-platform payments are out of scope. Not as described requires a material mismatch with the listing.",
          ),
          card(
            "Review before outcomes",
            "We aim to review protection claims within 3 business days using the evidence submitted — photos, tracking, and messages.",
          ),
          card(
            "Tracking protects everyone",
            "For shipped purchases, use tracked shipping and add tracking on the sale in Reswell. Local pickup is not covered.",
          ),
        ],
      },
      {
        kind: "cards",
        title: "If something goes wrong",
        cards: [
          card(
            "If your item never arrives",
            "You get back every dollar you paid — item price and shipping. No return needed when tracking confirms non-delivery.",
          ),
          card(
            "If your item is not as described",
            "A material mismatch from the listing gets a full refund and a prepaid return label. Minor cosmetic differences not mentioned in the listing do not qualify.",
          ),
          card(
            "If your item arrives damaged",
            "Transit damage gets a full refund and a prepaid return label. Photo evidence of the damage is required.",
          ),
        ],
      },
      {
        kind: "cards",
        title: "What's not covered",
        cards: [
          card("Buyer's remorse", "Changed your mind after purchase."),
          card("Subjective expectations", "The item matches the description but you expected something different."),
          card("Damage after delivery", "Damage you caused after receiving the item."),
          card("Local pickup", "Protection requires tracked shipping."),
          card("Off-platform payments", "Venmo, cash, bank transfer, and other payments outside Reswell."),
          card("Late claims", "Claims filed more than 30 days after confirmed delivery."),
        ],
      },
      {
        kind: "steps",
        title: "How to file a claim",
        steps: [
          { title: "Open Purchases", body: "Go to Purchases in your account." },
          { title: "Open the order", body: "Open the purchase you need help with." },
          {
            title: "Tap Get help",
            body: "Choose your issue, say whether you have already messaged the seller, and describe what happened. Add photos on claim flows.",
          },
          {
            title: "Submit the case",
            body: "We aim to review within 3 business days. Track replies under Reswell help.",
          },
        ],
      },
      {
        kind: "cards",
        title: "Protection window",
        cards: [
          card("Opens", "When your purchase is confirmed."),
          card(
            "Closes",
            "30 days after delivery confirmation — or when you leave a positive review, whichever comes first.",
          ),
          card("Where to see it", "The exact countdown is on your purchase detail page while protection is active."),
        ],
      },
      {
        kind: "paragraphs",
        title: "How protection is funded",
        paragraphs: [
          "Reswell funds buyer protection from our 7% marketplace fee. Sellers keep 93% of the sale price; there are no separate protection surcharges or deductions from seller payouts for this program.",
        ],
      },
    ],
  })
}

function dropoffSantaBarbara(): MobileInfoPage {
  return mobileInfoPageSchema.parse({
    slug: "dropoff-santa-barbara",
    title: "Santa Barbara drop-off",
    description:
      "Drop it off here. We pack and ship it nationwide — without you boxing the board yourself.",
    cta_label: "Start a listing",
    cta_href: SURFBOARD_SELL_BOARDS_CREATE_HREF,
    sections: [
      {
        kind: "paragraphs",
        title: "Drop it off here. We pack and ship it nationwide.",
        paragraphs: [
          "If your used surfboard hasn't sold locally, Santa Barbara drop-off is how you reach buyers across the country — without boxing it yourself. Choose this city when you list. After it sells, we send you the location.",
        ],
      },
      {
        kind: "cards",
        title: "Why drop-off",
        cards: [
          card("Stay local, sell farther", "You drop the board off in Santa Barbara. The buyer can be anywhere we ship."),
          card("We handle the box", "No carton run, no nose-and-tail pad job, no label print. That is the whole point."),
          card("Shipping after it sells", "Nothing leaves until a buyer checks out. Then we pack it and send it on."),
        ],
      },
      {
        kind: "paragraphs",
        title: "When local pickup is not enough",
        paragraphs: [
          "A used surfboard that sits in town is often exactly what someone nationwide is looking for. Offering shipping from Santa Barbara is how you reach them without becoming the shipper.",
          "Pickup-only listings stay in one zip code. Santa Barbara drop-off puts your used surfboard in front of buyers who will pay to have it shipped — and you still only drive across town after it sells.",
        ],
      },
      {
        kind: "steps",
        title: "Choose Santa Barbara when you list",
        steps: [
          {
            title: "List and choose Santa Barbara",
            body: "Add photos, details, and a price. When you get to packing, choose drop off in Santa Barbara — we pack and ship it. You do not enter a box size.",
          },
          {
            title: "Go live with shipping",
            body: "The listing offers shipping so buyers outside town can check out.",
          },
          {
            title: "We send drop-off details",
            body: "After it sells, you get the location on the sale page and by email. We do not publish the street address in the app.",
          },
          {
            title: "Drop it off — we ship it",
            body: "Bring the board in. Reswell packs it, buys the label, and ships it to the buyer. You get paid the same way as any other Reswell sale.",
          },
        ],
      },
      {
        kind: "cards",
        title: "Sizes we can ship from here",
        cards: [
          card(
            "Boards we drop off",
            `Up to ${SANTA_BARBARA_DROPOFF_MAX_LENGTH} overall. 6'0 and under need to be ${SANTA_BARBARA_DROPOFF_SHORTBOARD_MAX_WIDTH} wide or less. You will see this option in the sell flow when the board fits.`,
          ),
          card(
            "Outside those sizes",
            "Pack and ship it yourself, or keep the listing pickup-only. The how to ship guide covers boxes, labels, and local meetups.",
            { href: "/seller-resources/how-to-ship" },
          ),
        ],
      },
    ],
  })
}

export function buildMobileInfoPage(slug: MobileInfoPageSlug): MobileInfoPage {
  if (slug === "safety") return safety()
  if (slug === "protection-policy") return protectionPolicy()
  return dropoffSantaBarbara()
}

export function getMobileInfoPage(slug: string): MobileApiResult<MobileInfoPage> {
  if (!isInfoSlug(slug)) return { ok: false, status: 404, error: "Page not found" }
  return { ok: true, data: buildMobileInfoPage(slug) }
}
