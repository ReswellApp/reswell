import { SHIPPING_DEADLINE_DAYS } from "../../shipping-deadline.ts"
import { retrievalDoc } from "./build.ts"

export const buyingRetrievalDocs = [
  retrievalDoc({
    topicId: "buying",
    slug: "how-do-i-buy-a-board",
    title: "How do I buy on Reswell?",
    description:
      "Find boards, fins, wetsuits, and more, check out with Buy it now or the cart, and stay covered by Purchase Protection.",
    audience: "buyer",
    intentTags: ["buying_selling", "purchase", "cart", "general"],
    keywords: ["buy", "checkout", "purchase", "board", "fins", "wetsuit", "gear", "buy it now"],
    relatedIds: [
      "buying/what-can-i-buy",
      "buying/how-does-cart-work",
      "buying/local-pickup-or-shipping",
      "buying/how-do-i-pay",
      "buying/how-do-offers-work",
    ],
    quickAnswer:
      "Browse a marketplace category, open a listing, and tap Buy it now — or Add to cart and check out from Cart. You can also Message seller first or Make an offer when the seller has offers on. Pay only in Reswell checkout so Purchase Protection can apply.",
    sections: [
      {
        heading: "Find a listing",
        text: "Shop surfboards, fins, wetsuits, boardbags, surfpacks, leashes, apparel, accessories, and magazines. Use search and filters for brand, size, and price. Save a Board Finder alert if the exact board is not listed yet. Tap the heart to save a listing to Favorites.",
      },
      {
        heading: "Buy it now or use the cart",
        text: "Buy it now takes you straight to checkout. Add to cart if you want to review items, apply a promo code, or check out a few listings together. You must sign in so the purchase is tied to Purchase Protection and your order history. Choose Local pickup or Ship to me when both are offered, then pay through Stripe.",
      },
      {
        heading: "Not ready to buy yet?",
        text: "Message seller to ask about condition, what is included, or pickup timing. If offers are on, tap Make an offer. Keep every conversation and payment on Reswell. Off-platform payments are not covered by Purchase Protection.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "what-can-i-buy",
    title: "What can I buy on Reswell?",
    description:
      "Reswell is a peer marketplace for used surfboards and surf gear — plus a Reswell shop for items we sell directly.",
    audience: "buyer",
    intentTags: ["buying_selling", "general"],
    keywords: [
      "categories",
      "surfboards",
      "fins",
      "wetsuits",
      "boardbags",
      "surfpacks",
      "leashes",
      "apparel",
      "accessories",
      "magazines",
      "shop",
    ],
    relatedIds: ["buying/how-do-i-buy-a-board", "buying/how-to-search", "selling/what-can-i-sell"],
    quickAnswer:
      "Peer listings cover surfboards, fins, wetsuits, boardbags, surfpacks, leashes, apparel, accessories, and magazines. You can also shop items Reswell sells directly at Shop from Reswell.",
    sections: [
      {
        heading: "Marketplace categories",
        text: "Peer sellers list used surfboards and gear in these categories: Surfboards (/boards), Fins (/fins), Wetsuits (/wetsuits), Boardbags (/boardbags), Surfpacks (/surfpacks), Leashes (/leashes), Apparel (/apparel), Accessories (/accessories), and Magazines (/magazines). Every peer listing uses the same checkout, offers, messages, and Purchase Protection rules.",
      },
      {
        heading: "Shop from Reswell",
        text: "Some items are sold by Reswell, not a peer seller. Those live at /reswell/shop. Checkout still happens on Reswell. If you are unsure who the seller is, check the listing's About seller section.",
      },
      {
        heading: "What is not sold here",
        text: "Reswell is for physical used surf gear. We do not sell digital goods or process payments off the platform. If a listing looks wrong for the category or asks you to pay elsewhere, report it.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "how-to-search",
    title: "How do I search and filter listings?",
    description:
      "Use marketplace search, category filters, and brand pages to find the right board or gear.",
    audience: "buyer",
    intentTags: ["buying_selling", "search"],
    keywords: ["search", "filter", "browse", "brand", "natural language"],
    relatedIds: [
      "buying/how-do-i-buy-a-board",
      "buying/how-board-finder-works",
      "buying/what-can-i-buy",
    ],
    quickAnswer:
      "Use the header search or a category page (for example /boards). Type a brand, model, or what you want in plain language, then narrow with filters. Brand pages and Recently sold are also useful for comps.",
    sections: [
      {
        heading: "Search from anywhere",
        text: "The site search understands brands, models, and everyday phrases like '7'2 fish under 600 in San Diego'. Results can span categories. Open a result to see photos, condition, and pickup or shipping.",
      },
      {
        heading: "Filters on category pages",
        text: "Each category has filters for the details that matter there — board type, length, volume, condition, price, location, fin system, and more. Combine filters instead of scrolling an unfiltered grid.",
      },
      {
        heading: "Brands, sold comps, and alerts",
        text: "Brand pages collect models and live listings. Recently sold (/sold) shows what actually closed. If nothing matches, save a Board Finder alert and we email you when a listing fits.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "how-board-finder-works",
    title: "How does Board Finder work?",
    description:
      "Save a search for a specific board or set of filters and get an email when a matching listing goes live.",
    audience: "buyer",
    intentTags: ["buying_selling", "search"],
    keywords: ["board finder", "alert", "saved search", "wishlist", "notify"],
    relatedIds: ["buying/how-to-search", "buying/how-do-favorites-work", "buying/how-do-i-buy-a-board"],
    quickAnswer:
      "Go to Board Finder, set brand, model, size, condition, or price filters, and save the search. We email you when a new listing matches. You can keep up to 5 saved searches per account.",
    sections: [
      {
        heading: "Create an alert",
        text: "Open /board-finder and add the details you care about — brand, model, style, length, condition, price range, volume, construction, or fin system. You need enough specificity for a useful alert. Sign in to save it. Email opt-in is on by default when you save.",
      },
      {
        heading: "Limits and managing alerts",
        text: "Each account can save up to 5 searches across marketplace categories. Manage or delete them on the Board Finder page. A match email links you to the listing so you can favorite it, message the seller, or buy.",
      },
      {
        heading: "Favorites vs Board Finder",
        text: "Favorites save a specific live listing. Board Finder watches for listings that do not exist yet. Use both if you are shopping a few boards and waiting on a particular model.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "how-do-favorites-work",
    title: "How do favorites work on Reswell?",
    description:
      "Save listings you are eyeing, compare them later, and jump back to buy when the timing is right.",
    audience: "buyer",
    intentTags: ["buying_selling"],
    keywords: ["favorite", "save", "wishlist", "heart"],
    relatedIds: [
      "buying/how-do-i-buy-a-board",
      "buying/how-to-follow-a-shop",
      "buying/how-board-finder-works",
    ],
    quickAnswer:
      "Tap the heart on any listing to save it. Open Favorites from the profile menu or /dashboard/favorites. Sold listings stay on the list with a sold badge.",
    sections: [
      {
        heading: "Saving a listing",
        text: "Tap the heart on a listing tile or detail page. You must be signed in. Guests are asked to sign in or create an account first.",
      },
      {
        heading: "Managing your list",
        text: "Open Favorites to compare listings, watch for price changes, or remove a heart. Sold items remain for reference with a sold badge.",
      },
      {
        heading: "Ready to buy?",
        text: "Open a saved listing and use Buy it now, Add to cart, Make an offer, or Message seller the same way you would from browse.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "how-to-follow-a-shop",
    title: "How do I follow a seller's shop?",
    description:
      "Follow shops you like to see new listings in your Following feed and get notified when they post.",
    audience: "buyer",
    intentTags: ["buying_selling", "following", "notifications"],
    keywords: ["follow", "shop", "seller", "following", "followers"],
    relatedIds: ["buying/how-do-favorites-work", "buying/how-to-contact-a-seller", "accounts/where-are-messages"],
    quickAnswer:
      "Open a seller's shop page and tap Follow. New listings show up in Following. You can manage follows from /dashboard/following.",
    sections: [
      {
        heading: "Follow a shop",
        text: "Every peer listing has an About seller section that links to the shop. On the shop page, tap Follow. You need to be signed in.",
      },
      {
        heading: "Where new listings appear",
        text: "Followed shops appear in /following and /dashboard/following. Reswell can also send a notification or email when a shop you follow lists something new, depending on your notification settings.",
      },
      {
        heading: "Unfollow",
        text: "Open the shop or your Following list and tap Following to unfollow. Favorites on individual listings are separate — unfollowing a shop does not remove hearts.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "how-do-offers-work",
    title: "How do offers work on Reswell?",
    description:
      "Make an offer on a listing, respond to counteroffers, and check out at the price you and the seller agree on.",
    audience: "buyer",
    intentTags: ["buying_selling", "offers"],
    keywords: ["offer", "counter", "negotiate", "make an offer"],
    relatedIds: ["buying/how-do-i-buy-a-board", "buying/how-long-to-pay", "selling/respond-to-offers"],
    quickAnswer:
      "When a seller has offers on, tap Make an offer. They can accept, counter, or decline in Messages. Offers expire in 48 hours. After you agree, go back to the listing and tap Buy it now — checkout applies the agreed price.",
    sections: [
      {
        heading: "When you can make an offer",
        text: "Offers work on active peer listings when the seller enabled them. One open offer per listing at a time. Most sellers set a minimum around 70% of list price; the dialog shows the floor. Pick Shipped or Local pickup, enter a price or a quick 5% / 10% off, add an optional 200-character note, and submit. The seller has 48 hours.",
      },
      {
        heading: "What happens after you submit",
        text: "The offer appears in Messages and on Offers under I made. The seller can accept, counter (up to three counters per thread), or decline. You are not charged until you pay at checkout.",
      },
      {
        heading: "Paying after an offer is accepted",
        text: "Return to the listing and tap Buy it now. Checkout applies the agreed price, then adds shipping (if you chose delivery) and any tax. Pay before the deadline in Messages or email — the listing can still sell to someone else at list price if you wait.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "local-pickup-or-shipping",
    title: "How do I know if a listing offers pickup or shipping?",
    description:
      "Every listing shows how you can get the item. Here is how to read those options and what they mean at checkout.",
    audience: "buyer",
    intentTags: ["buying_selling", "shipping", "purchase"],
    keywords: ["pickup", "shipping", "delivery", "local pickup", "flat rate"],
    relatedIds: [
      "buying/how-do-i-buy-a-board",
      "buying/package-delayed-or-lost",
      "buying/purchase-protection-claim",
    ],
    quickAnswer:
      "Look near the price for Local pickup, Shipping, Free shipping, or Pickup or shipping. If both are offered, choose at checkout. Purchase Protection requires tracked shipping — local pickup is not covered by protection claims.",
    sections: [
      {
        heading: "Reading the listing",
        text: "Local pickup means you meet the seller in person. Flat rate shipping is a fixed amount. Free shipping means no extra shipping charge before tax. Shipping (rate at checkout) means Reswell calculates the carrier rate from the box size and your address.",
      },
      {
        heading: "Choosing at checkout",
        text: "If both options exist, checkout shows Delivery method: Local pickup or Ship to me. After a shipped purchase, the seller adds tracking. Follow it from Purchases and tap Track package when the carrier link is ready.",
      },
      {
        heading: "Pickup after purchase",
        text: "You get a pickup code on the purchase page. Agree on a safe public spot in Messages, inspect the item, then share the code. Read Safety tips before meeting anyone. Local pickup is not covered by Purchase Protection claims.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "how-does-cart-work",
    title: "How does the cart work?",
    description:
      "Add listings to your cart, apply a promo code, and check out when you are ready.",
    audience: "buyer",
    intentTags: ["buying_selling", "cart", "promo", "payments"],
    keywords: ["cart", "add to cart", "basket", "checkout"],
    relatedIds: ["buying/how-do-i-buy-a-board", "buying/promo-codes", "buying/how-do-i-pay"],
    quickAnswer:
      "Tap Add to cart on a listing, then open /cart to review items, apply a promo code, and continue to checkout. Buy it now still skips the cart if you want to pay immediately.",
    sections: [
      {
        heading: "Adding items",
        text: "On a listing, tap Add to cart. You need to be signed in. Cart holds marketplace listings you are still considering. Items can sell to someone else until you complete payment.",
      },
      {
        heading: "Review and check out",
        text: "Open /cart to remove items, apply a promo code, and continue to checkout. Delivery method, tax, and payment are confirmed on the checkout page — not on the cart summary.",
      },
      {
        heading: "Cart vs Buy it now",
        text: "Use the cart to compare or apply a code. Use Buy it now when you already know you want that listing. Both routes pay through Reswell checkout.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "how-do-i-pay",
    title: "How do I pay for a purchase?",
    description:
      "Pay securely at checkout through Stripe with card, Link, Apple Pay, Google Pay, or Klarna. Off-platform payments are not accepted.",
    audience: "buyer",
    intentTags: ["payments", "purchase"],
    keywords: ["pay", "card", "checkout", "stripe", "apple pay", "google pay", "link", "klarna"],
    relatedIds: [
      "buying/wallet-balance-at-checkout",
      "buying/promo-codes",
      "buying/why-charged-tax",
      "buying/how-does-cart-work",
    ],
    quickAnswer:
      "Pay in Reswell checkout through Stripe: debit or credit card, Link, Apple Pay, Google Pay, or Klarna where available. We do not accept Venmo, PayPal, cash, or wires outside the app.",
    sections: [
      {
        heading: "Supported payment methods",
        text: "Checkout runs on Stripe. Card details go into Stripe's form — Reswell never stores the full card number. Methods: debit or credit card, Link, Apple Pay on supported Apple devices, Google Pay on supported Android/Chrome, and Klarna where available.",
      },
      {
        heading: "What you pay",
        text: "The summary shows Subtotal (list or accepted offer), Shipping when it applies, tax if required, and Total in USD. Promo codes discount item price only, not shipping. Wallet balance from past sales can apply toward the total.",
      },
      {
        heading: "Payments we do not accept",
        text: "Every purchase must go through Reswell checkout. Off-platform payments are not covered by Purchase Protection. If a seller asks you to pay elsewhere, report the listing and contact support.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "promo-codes",
    title: "How do promo codes work?",
    description:
      "Apply a newsletter or Reswell-issued promo code on cart or checkout. Discounts apply to item price only.",
    audience: "buyer",
    intentTags: ["payments", "promo", "cart"],
    keywords: ["promo", "coupon", "discount", "code", "newsletter", "gift card"],
    relatedIds: ["buying/how-does-cart-work", "buying/how-do-i-pay", "buying/wallet-balance-at-checkout"],
    quickAnswer:
      "Sign in, add items to your cart or open checkout, and enter the code. Newsletter welcome codes only work on the account email they were sent to. The discount applies to item price, not shipping. Gift cards are not available yet. Sellers still receive the full item price — Reswell covers the discount.",
    sections: [
      {
        heading: "Where to apply a code",
        text: "Promo codes can be applied on Cart or checkout when you are signed in. Enter the code and tap Apply. If you typed it on cart, checkout should pick it up.",
      },
      {
        heading: "What codes cover",
        text: "The discount applies to item price only, not shipping or tax. Newsletter welcome codes are tied to the email that received them. Admin-issued codes follow the rules shown when they were sent.",
      },
      {
        heading: "What is not available",
        text: "Gift cards are not available yet. A code that does not apply will show an error — check that you are signed in with the right email and that the cart has eligible items.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "wallet-balance-at-checkout",
    title: "Can I use wallet balance at checkout?",
    description:
      "Your wallet holds earnings from past sales. Here is how it works at checkout and how it connects to cash outs.",
    audience: "both",
    intentTags: ["payments", "wallet"],
    keywords: ["wallet", "balance", "store credit", "earnings"],
    relatedIds: [
      "buying/how-do-i-pay",
      "accounts/wallet-and-earnings-overview",
      "accounts/how-cash-outs-work",
    ],
    quickAnswer:
      "Ready wallet balance from completed sales can apply toward another Reswell purchase at checkout. If it does not cover the full total, pay the rest by card through Stripe. Refunds on wallet-paid orders return to the wallet.",
    sections: [
      {
        heading: "What is wallet balance?",
        text: "The wallet holds earnings from completed Reswell sales. After a sale clears Purchase Protection timelines, funds show in Earnings as ready. You can spend ready balance or cash out to your bank.",
      },
      {
        heading: "Using balance toward a purchase",
        text: "If you have ready balance, checkout can apply it. Card payment covers any remainder. Check the balance anytime in Earnings.",
      },
      {
        heading: "Cash outs and refunds",
        text: "Cash out from Earnings once your payout destination is connected and verified. Wallet-paid refunds return to the wallet. Card refunds return to the card through Stripe, usually within 5 to 10 business days.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "why-charged-tax",
    title: "Why was I charged tax on my order?",
    description: "When sales tax applies on Reswell purchases and where to see it on your order.",
    audience: "buyer",
    intentTags: ["payments", "purchase"],
    keywords: ["tax", "sales tax", "vat"],
    relatedIds: ["buying/how-do-i-pay", "buying/how-do-i-buy-a-board"],
    quickAnswer:
      "Reswell may collect sales tax when state and local law requires it, based on your delivery address and the order. Tax is calculated at checkout on item price plus shipping when shipping applies.",
    sections: [
      {
        heading: "When sales tax applies",
        text: "Marketplace tax rules depend on destination, the item, and applicable law. The exact amount is calculated at checkout from your order details.",
      },
      {
        heading: "Where to see tax",
        text: "Cart may show Tax: Calculated at checkout. Review the full total before you tap Pay now. After purchase, the confirmation and purchase page show what you paid, including tax.",
      },
      {
        heading: "Questions about a charge",
        text: "Double-check the delivery address — rates vary by state and city. Offer totals during negotiation are before tax. Contact support with the order number if a charge looks wrong.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "how-long-to-pay",
    title: "How long do I have to pay for my Reswell purchase?",
    description:
      "When to complete checkout, how long offers stay open, and what to do after a seller accepts your offer.",
    audience: "buyer",
    intentTags: ["buying_selling", "offers", "payments"],
    keywords: ["pay", "deadline", "checkout", "expire"],
    relatedIds: ["buying/how-do-offers-work", "buying/how-do-i-pay", "buying/how-do-i-buy-a-board"],
    quickAnswer:
      "Finish Buy it now checkout as soon as you can — the listing stays available until payment succeeds. Offers expire 48 hours after you submit them unless the seller responds sooner. After an accepted offer, pay promptly; the listing can still sell at list price.",
    sections: [
      {
        heading: "Buy it now purchases",
        text: "The listing remains available to other buyers until your payment goes through. Sign in and have address and payment ready.",
      },
      {
        heading: "Offer deadlines",
        text: "Offers expire 48 hours after submission. Countdown shows in Messages and on Offers. Expired offers can be replaced with a new offer if the listing is still active.",
      },
      {
        heading: "Paying after an accepted offer",
        text: "Go back to the listing, tap Buy it now, and complete checkout. Check Messages and email for deadline reminders.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "change-shipping-address",
    title: "How can I change the shipping address on my purchase?",
    description:
      "How to update a delivery address before the seller ships, and what to do if a label is already printed.",
    audience: "buyer",
    intentTags: ["purchase", "shipping"],
    keywords: ["address", "shipping", "wrong address", "change address"],
    relatedIds: [
      "buying/how-to-contact-a-seller",
      "buying/package-delayed-or-lost",
      "buying/get-help-with-a-purchase",
    ],
    quickAnswer:
      "Message the seller immediately with the corrected address. You can only change it before a shipping label is purchased. If a label already exists or the package has shipped, contact Reswell support with the order number and both addresses.",
    sections: [
      {
        heading: "Act quickly",
        text: "Address changes only work before the seller buys a label. Once a label exists, the carrier may not allow changes. The seller might need to void it and print a new one.",
      },
      {
        heading: "Steps",
        text: "Open the purchase thread from Purchases or Messages. Send the full corrected address. Ask the seller to confirm before they ship. If they already shipped or cannot change it, contact support.",
      },
      {
        heading: "Avoid mistakes",
        text: "Double-check the address in checkout. You can save addresses and pick Use a different address on future orders. We cannot redirect a package once the carrier has it.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "package-delayed-or-lost",
    title: "What should I do if my package is delayed or lost?",
    description:
      "Your order is late, tracking has stalled, or the package never showed up. Here is what to do, step by step.",
    audience: "buyer",
    intentTags: ["purchase", "shipping", "claim"],
    keywords: ["delayed", "lost", "tracking", "never arrived", "late"],
    relatedIds: [
      "buying/purchase-protection-claim",
      "buying/get-help-with-a-purchase",
      "buying/how-to-contact-a-seller",
    ],
    quickAnswer:
      "Check tracking on the purchase page first. Sellers are expected to ship within 7 days of confirmation. If tracking stalls or the package is lost, message the seller, check the carrier, then tap Get help and file a Purchase Protection claim for eligible tracked shipments.",
    sections: [
      {
        heading: "Check tracking first",
        text: "Open Purchases. If the seller shipped, you will see a tracking number and Track package. Carrier scans can lag a day or two after the label is created. Tap I received my item once it arrives.",
      },
      {
        heading: "If the seller has not shipped yet",
        text: `Sellers are expected to ship within ${SHIPPING_DEADLINE_DAYS} days of purchase confirmation. The purchase page shows the deadline. Message the seller or tap Get help if shipping is delayed.`,
      },
      {
        heading: "Delayed or lost after shipping",
        text: "Message the seller with the tracking number. Check the carrier for exceptions or return-to-sender. If tracking shows lost or has not moved for a long time, open Get help and start a Purchase Protection non-delivery claim on eligible tracked shipments.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "buyer-returns",
    title: "How do returns work for buyers on Reswell?",
    description:
      "How to return an item, file a Purchase Protection claim, and start a refund request from your purchase page.",
    audience: "buyer",
    intentTags: ["returns", "protection", "claim", "purchase"],
    keywords: ["return", "refund", "exchange"],
    relatedIds: [
      "buying/purchase-protection-claim",
      "buying/get-help-with-a-purchase",
      "buying/how-to-contact-a-seller",
    ],
    quickAnswer:
      "For covered problems on shipped orders, tap Get help on the purchase page or file a Purchase Protection claim. Qualifying U.S. returns need to start within 7 calendar days of delivery. There are no exchanges and no restocking fee. Reswell provides a prepaid return label when one is needed.",
    sections: [
      {
        heading: "Return policy overview",
        text: "The Return Policy applies to eligible U.S. purchases through Reswell checkout. We accept returns for defective and non-defective products when you meet eligibility. No exchanges. Start within 7 calendar days of delivery for shipped purchases. Refunds usually process within about 7 days after we receive and confirm the return.",
      },
      {
        heading: "Purchase Protection vs returns",
        text: "Purchase Protection covers item never arrives, materially different from the listing, or damaged in transit on eligible checkout purchases — file within 30 days of confirmed delivery. That is separate from change of mind. Defective or quality issues on shipped orders usually go through protection. Local pickup-only purchases may not qualify for checkout-backed returns.",
      },
      {
        heading: "How to start",
        text: "Message the seller first. Then open Purchases, tap Get help, choose a Purchase Protection claim or another issue, and tell us if you already contacted the seller. We typically review protection claims within 3 business days. Track replies under Support.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "purchase-protection-claim",
    title: "How am I protected if I do not receive an item or it is not as described?",
    description:
      "What Purchase Protection covers, what it does not, and how to file a claim from your purchase page.",
    audience: "buyer",
    intentTags: ["protection", "claim", "purchase"],
    keywords: ["protection", "claim", "dispute", "not as described", "damaged", "never arrived"],
    relatedIds: [
      "buying/buyer-returns",
      "buying/get-help-with-a-purchase",
      "buying/package-delayed-or-lost",
    ],
    quickAnswer:
      "Purchase Protection is included on eligible checkout purchases at no extra fee. It covers item never arrives (tracked), arrives damaged, or is clearly different from the listing. Local pickup and off-platform payments are not covered. File from Get help within 30 days of confirmed delivery.",
    sections: [
      {
        heading: "What it covers",
        text: "Approved claims refund the item price and shipping you paid. Item never arrives: tracking confirms non-delivery, no return needed. Not as described: wrong size, hidden damage, wrong model — full refund plus a prepaid return label; refund releases after the seller confirms they got it back. Arrives damaged: transit damage with photos, same return process.",
      },
      {
        heading: "What is not covered",
        text: "Buyer's remorse, subjective performance, damage after you receive the item, local pickup, payments outside Reswell checkout, and claims filed more than 30 days after confirmed delivery. Leaving a positive review closes the protection window early.",
      },
      {
        heading: "How to file",
        text: "Open the confirmed purchase in Purchases, tap Get help, choose a Purchase Protection claim, say whether you messaged the seller, and include tracking, dates, and photos. We typically review within 3 business days. Refunds go to the original payment method (card via Stripe, or wallet for wallet-paid orders).",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "get-help-with-a-purchase",
    title: "How do I get help with a purchase or sale?",
    description:
      "Where to open Get help, what to choose for claims, cancels, and questions, and how to track your case.",
    audience: "both",
    intentTags: ["purchase", "sale", "claim", "general"],
    keywords: ["get help", "support", "ticket", "help hub", "contact support", "case"],
    relatedIds: [
      "buying/purchase-protection-claim",
      "buying/buyer-returns",
      "accounts/how-to-contact-support",
      "selling/cancel-order-seller",
    ],
    quickAnswer:
      "Message the other person first. If you still need us, open the purchase or sale and tap Get help, or start from Support (/support or /dashboard/support). Choose a purchase, sale, Purchase Protection claim, or another topic. We typically review protection claims within 3 business days.",
    sections: [
      {
        heading: "Start on the order",
        text: "Buyers: open Purchases, open the order, tap Get help. Sellers: open Sales, open the order, tap Get help with this sale. Pick a Purchase Protection claim, cancel, or a question about the order. Tell us if you already contacted the other person when asked.",
      },
      {
        heading: "Support hub when there is no order",
        text: "Use /support (or /dashboard/support when signed in) for buying or selling questions, payments and payouts, account issues, or safety reports. Search the Help Center from that page if an article already answers it.",
      },
      {
        heading: "What to include",
        text: "Order number, listing link, tracking, dates, and photos. Keep the conversation in Reswell Messages so we have a record. Track replies under Support. Do not send payment details or passwords.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "how-to-contact-a-seller",
    title: "How to contact a seller",
    description:
      "Every way to reach a seller on Reswell, and why keeping the conversation on the platform helps if something goes wrong.",
    audience: "buyer",
    intentTags: ["messages", "buying_selling", "purchase"],
    keywords: ["message", "seller", "contact", "chat"],
    relatedIds: ["buying/how-do-offers-work", "buying/get-help-with-a-purchase", "accounts/where-are-messages"],
    quickAnswer:
      "Tap Message seller on the listing or purchase page, or open Messages in the header. Offers also live in the thread and on Offers. Keep purchase talk on Reswell so support can review it.",
    sections: [
      {
        heading: "Where to start",
        text: "Listing page: Message seller in About seller. Purchase page: Message seller from Purchases. Inbox: /messages. Offers: Messages or /dashboard/offers.",
      },
      {
        heading: "What to use Messages for",
        text: "Condition questions, pickup timing, address changes before ship, delivery problems, and offer counters.",
      },
      {
        heading: "Keep it on Reswell",
        text: "Support can only review on-platform threads for claims. If someone asks you to pay outside the app, move to text only, or share financial info, report it and read Safety tips.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "buying",
    slug: "leave-seller-review",
    title: "How do I leave a review for a seller?",
    description:
      "After delivery or pickup, review the seller from your purchase page. A positive review can close Purchase Protection early.",
    audience: "buyer",
    intentTags: ["reviews", "purchase"],
    keywords: ["review", "feedback", "rating", "stars"],
    relatedIds: [
      "buying/purchase-protection-claim",
      "selling/leave-feedback-buyer",
      "buying/get-help-with-a-purchase",
    ],
    quickAnswer:
      "Once the item is delivered or pickup is complete, open the purchase and tap Review seller. Leave a star rating and comment. A positive review can close your Purchase Protection window on that order early — finish any claim first if something is wrong.",
    sections: [
      {
        heading: "When you can review",
        text: "You can leave a review after carrier tracking shows delivery, or after local pickup is completed. Reswell also emails a review request.",
      },
      {
        heading: "How to review",
        text: "Open Purchases, open the order, and tap Review seller. Keep feedback factual. Reviews help other buyers.",
      },
      {
        heading: "Reviews and Purchase Protection",
        text: "A positive review can close the protection window early, even before 30 days. If the item is wrong or damaged, file a claim before you leave a positive review.",
      },
    ],
  }),
]
