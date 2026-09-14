import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "../../seller-fees.ts"
import { SHIPPING_DEADLINE_DAYS } from "../../shipping-deadline.ts"
import { retrievalDoc } from "./build.ts"

export const sellingRetrievalDocs = [
  retrievalDoc({
    topicId: "selling",
    slug: "we-buy-your-surfboard",
    title: "Will Reswell buy my surfboard?",
    description:
      "How We’ll buy your surfboard works: submit photos and a price, get a quote in under 30 minutes, ship in the required box, and get paid to your wallet.",
    audience: "seller",
    intentTags: ["we-buy", "sale", "payouts"],
    keywords: ["we buy", "we'll buy", "reswell buy", "quote", "sell to reswell", "board buy"],
    relatedIds: [
      "selling/we-buy-shipping-and-boxes",
      "selling/how-to-list-a-board",
      "accounts/how-cash-outs-work",
    ],
    quickAnswer:
      "Yes. Sign in and go to We’ll buy your surfboard (/we-buy). Upload photos, a title, and your asking price. We reply in under 30 minutes with an accept or our best offer. If we miss that window, you automatically get an offer at 20% off your asking price. After you accept, box the board (max 22 inches wide and 5 inches high), send packed measurements, then we buy the prepaid label. We pay your wallet when the board arrives.",
    sections: [
      {
        heading: "Submit a quote",
        text: "Sign in and open /we-buy, then Get a quote at /we-buy/submit. Add a title, asking price, and clear photos. Wallet payouts need an account. Track submissions at /dashboard/we-buy.",
      },
      {
        heading: "How we respond",
        text: "We accept your asking price or send our best offer within 30 minutes. If we miss that window, you automatically receive an offer at 20% off your asking price. You can still list on the marketplace instead at any time.",
      },
      {
        heading: "After you accept",
        text: "You must ship in a carton no more than 22 inches wide and 5 inches high. Pack the board, then send outer measurements and weight. We purchase the prepaid label only after those packed measurements — not at accept. Payment hits your Reswell wallet once we receive the board. Cash out from Earnings when you are ready.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "we-buy-shipping-and-boxes",
    title: "What box do I need for We’ll buy your surfboard?",
    description:
      "Box size, packed measurements, and when Reswell buys the prepaid label for a We’ll buy quote.",
    audience: "seller",
    intentTags: ["we-buy", "shipping"],
    keywords: ["we buy box", "22 inches", "packed measurements", "prepaid label"],
    relatedIds: ["selling/we-buy-your-surfboard", "selling/how-to-ship-an-order"],
    quickAnswer:
      "Ship in a box no more than 22 inches wide and 5 inches high. After you accept a quote, pack the board and submit the outer measurements and weight. Reswell buys the prepaid label then — not when the quote is accepted.",
    sections: [
      {
        heading: "Required carton",
        text: "The board must ship in a carton no more than 22\" wide and 5\" high. If your board will not fit those limits, We’ll buy is not the right path — list it on the marketplace with a proper board box instead.",
      },
      {
        heading: "Packed measurements unlock the label",
        text: "Accepting a quote does not buy a label. Box the board first, then send packed length, width, height, and weight on the quote. We purchase the prepaid label after that. Print it and drop the package with the carrier.",
      },
      {
        heading: "Payment",
        text: "We pay your wallet when the board arrives and is checked in — not when you drop it off. Cash out to your bank from Earnings once the balance is ready.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "how-to-list-a-board",
    title: "How do I list something for sale?",
    description:
      "Create a listing on Reswell — boards, fins, wetsuits, and more — with photos, details, pickup or shipping, and your price. Listing is free.",
    audience: "seller",
    intentTags: ["listings", "buying_selling"],
    keywords: ["list", "sell", "post", "create listing", "draft"],
    relatedIds: [
      "selling/what-can-i-sell",
      "selling/listing-photos-and-pricing",
      "selling/edit-or-remove-listing",
      "selling/marketplace-fees",
    ],
    quickAnswer:
      "Tap Sell, choose a category, add photos and details, choose pickup and/or shipping, set your price, and hit Create Listing. You can turn on offers. Listing is free — Reswell takes a fee only when a sale completes.",
    sections: [
      {
        heading: "Getting started",
        text: "Sign in and go to /sell. Pick the category (surfboards, fins, wetsuits, boardbags, surfpacks, leashes, apparel, accessories, or magazines). Search the catalog by brand or model to jump-start board listings. Save a draft and come back. Edit live listings from My Listings.",
      },
      {
        heading: "What to include",
        text: "Title up to 60 characters, at least one photo (up to 12). Add condition, brand, model, size or dimensions, and an honest description up to 1,000 characters. Set location, then Shipping, Local pickup, or both. For shipping, choose Reswell-calculated rates, free shipping, or a flat rate. Optional: Drop the price in 2 weeks, and Allow buyers to make offers.",
      },
      {
        heading: "After you publish",
        text: `The listing goes live on the matching category page. Buyers can favorite it, message you, make an offer, add it to cart, or buy. Listing is free. Reswell takes a ${MARKETPLACE_FEE_PERCENT}% marketplace fee only when a sale completes.`,
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "what-can-i-sell",
    title: "What can I sell on Reswell?",
    description:
      "Peer categories you can list, and when We’ll buy your surfboard is a better fit than a marketplace listing.",
    audience: "seller",
    intentTags: ["listings", "we-buy", "buying_selling"],
    keywords: ["sell", "categories", "allowed", "prohibited"],
    relatedIds: ["selling/how-to-list-a-board", "selling/we-buy-your-surfboard", "buying/what-can-i-buy"],
    quickAnswer:
      "List used surfboards, fins, wetsuits, boardbags, surfpacks, leashes, apparel, accessories, and magazines. Listing is free. If you want Reswell to buy a surfboard directly, use We’ll buy instead of a peer listing.",
    sections: [
      {
        heading: "Peer marketplace categories",
        text: "Sell used physical surf gear in: surfboards, fins, wetsuits, boardbags, surfpacks, leashes, apparel, accessories, and magazines. Each category has its own sell flow under /sell.",
      },
      {
        heading: "We’ll buy vs list it yourself",
        text: "We’ll buy is only for surfboards that fit the required shipping box. You get a quote from Reswell and we handle the label after you pack it. A marketplace listing reaches peer buyers and can include pickup, calculated shipping, and offers.",
      },
      {
        heading: "Keep listings honest",
        text: "Photos and condition notes should match the item. Inaccurate listings are the main reason for Purchase Protection claims and returns. Do not ask buyers to pay outside Reswell.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "listing-photos-and-pricing",
    title: "Tips for photos and pricing your listing",
    description:
      "Take photos that sell your gear and price it fairly against similar listings and recent sales on Reswell.",
    audience: "seller",
    intentTags: ["listings", "buying_selling"],
    keywords: ["photos", "price", "pricing", "comps"],
    relatedIds: ["selling/how-to-list-a-board", "selling/marketplace-fees", "selling/respond-to-offers"],
    quickAnswer:
      "Shoot in natural light, show every angle and every flaw, and upload up to 12 photos. Check Recently sold for similar brand, size, and condition. Remember the marketplace fee is on item price only.",
    sections: [
      {
        heading: "Photos",
        text: "Natural light. Whole item plus accessories. Close-ups of wear. For boards: deck, bottom, rails, nose, tail, and fin setup if fins are included. Drag to reorder.",
      },
      {
        heading: "Pricing",
        text: `Use /sold for comps. Price a little high if you expect offers, or set a firm price for a fast sale. Factor shipping. You keep ${SELLER_SHARE_PERCENT}% of the item price. Optional automatic drop after two weeks. Offers usually have a floor around 70% of list.`,
      },
      {
        heading: "Description",
        text: "Say how long you owned it, how often you used it, repairs, size, and what is included. The AI description helper is a draft — read it before you publish.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "edit-or-remove-listing",
    title: "How do I edit or remove a listing?",
    description:
      "Update a live listing, use vacation mode, mark an item as sold, or end a listing from My Listings.",
    audience: "seller",
    intentTags: ["listings"],
    keywords: ["edit", "delete", "vacation", "end listing", "mark as sold"],
    relatedIds: ["selling/how-to-list-a-board", "selling/i-sold-an-item-whats-next"],
    quickAnswer:
      "Open My Listings and tap Edit to change photos, price, shipping, or offers. End listing to hide it with vacation mode, mark it sold elsewhere, or delete it when it is not tied to an order.",
    sections: [
      {
        heading: "Editing",
        text: "From /dashboard/listings tap Edit, update the listing, then Save changes. View shows the live buyer page.",
      },
      {
        heading: "Mark as sold",
        text: "If you sold the item elsewhere, choose Mark as Sold. That removes it from the marketplace and moves it to Sold. We may ask for an optional tip and rating.",
      },
      {
        heading: "Vacation mode, end, or delete",
        text: "Vacation mode temporarily hides an active listing from browse and search until you go live again. End listing offers vacation, mark as sold, or delete. Delete is only available when the listing is not tied to an order or payment.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "verify-seller-information",
    title: "How to verify your seller information",
    description:
      "Complete seller verification so you can receive payouts and cash out earnings from Reswell sales.",
    audience: "seller",
    intentTags: ["payouts", "account", "payments"],
    keywords: ["verify", "payout", "identity", "stripe", "kyc"],
    relatedIds: [
      "selling/connect-payout-account",
      "selling/how-long-to-get-paid",
      "selling/where-payouts-available",
    ],
    quickAnswer:
      "Before your first cash out, complete identity verification in Earnings through Stripe Connect. Have your legal name, address, and ID ready. Then connect the bank account for payouts.",
    sections: [
      {
        heading: "Why verification matters",
        text: "Reswell and Stripe need to confirm who you are and where payouts go. This is standard for marketplace sellers.",
      },
      {
        heading: "How to complete setup",
        text: "Open Earnings. If payout details are missing, tap Complete payout details. Stripe may ask for legal name, date of birth, address, and last four of SSN for U.S. sellers. Then connect your bank.",
      },
      {
        heading: "If something does not verify",
        text: "Match your name to your bank account and government ID. Typos cause most delays. Contact support from the email on the account if you are stuck.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "connect-payout-account",
    title: "How to connect a bank account for payouts",
    description:
      "Link a U.S. bank account in Earnings to cash out your Reswell seller earnings via ACH transfer.",
    audience: "seller",
    intentTags: ["payouts", "payments"],
    keywords: ["bank", "payout", "connect", "ACH"],
    relatedIds: [
      "selling/verify-seller-information",
      "accounts/how-cash-outs-work",
      "selling/where-payouts-available",
    ],
    quickAnswer:
      "Open Earnings and complete Bank transfer (ACH) setup through Stripe Connect. Reswell does not store your full account number. Use Manage payout banks to update accounts later.",
    sections: [
      {
        heading: "Where to connect",
        text: "Earnings shows Complete bank setup to cash out if nothing is linked. Bank details go to Stripe.",
      },
      {
        heading: "Managing banks",
        text: "After setup, Manage payout banks lets you add or update accounts. Keep details current so transfers are not returned.",
      },
      {
        heading: "Before the first cash out",
        text: "Verification must be complete and you need ready (not pending) balance. Pending earnings wait for tracked delivery (plus a 24-hour review window) or verified pickup.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "where-payouts-available",
    title: "Where are Reswell payouts available?",
    description:
      "Which regions support Reswell seller payouts and what to do if bank setup is not available where you live.",
    audience: "seller",
    intentTags: ["payouts", "payments"],
    keywords: ["payout", "region", "country", "international"],
    relatedIds: ["selling/connect-payout-account", "selling/verify-seller-information"],
    quickAnswer:
      "Bank transfer (ACH) cash outs are built for U.S. bank accounts via Stripe Connect. Other countries depend on Stripe support and verification. You can still spend ready wallet balance on Reswell listings.",
    sections: [
      {
        heading: "Current support",
        text: "ACH cash outs target U.S. banks. You can often still list and sell; cash out options vary. Check Earnings after your first sale.",
      },
      {
        heading: "If setup is unavailable",
        text: "Contact support for the latest options for your country. Ready wallet balance can still be spent on other Reswell listings.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "i-sold-an-item-whats-next",
    title: "I made a sale. What should I do next?",
    description:
      "Your listing sold on Reswell. Here is how to ship it, coordinate pickup, and get your earnings released.",
    audience: "seller",
    intentTags: ["sale", "shipping"],
    keywords: ["sold", "ship", "next steps", "fulfill"],
    relatedIds: [
      "selling/how-to-ship-an-order",
      "selling/how-long-to-get-paid",
      "selling/cancel-order-seller",
    ],
    quickAnswer:
      "Open the sale in Sales. Ship with tracking or verify local pickup in Messages. Earnings release to your wallet once the order clears Purchase Protection timelines — tracked delivery plus 24 hours, or a verified pickup code.",
    sections: [
      {
        heading: "Open your sale",
        text: "Go to /dashboard/sales. You will see Ship to buyer or Local pickup, buyer details, and the message thread. Reply promptly.",
      },
      {
        heading: "If you are shipping",
        text: `Pack carefully. For Reswell shipping, Reswell purchases the cheapest carrier label after checkout and adds tracking. Print the label from the sale page, drop it off, then tap I've dropped this off with the carrier. For your own label, Add tracking and Save tracking. Ship within ${SHIPPING_DEADLINE_DAYS} days of confirmation.`,
      },
      {
        heading: "If it is local pickup",
        text: "Agree on a safe public place. The buyer has a 6-digit pickup code. When they are satisfied, they share it and you tap Verify pickup. That releases your payout. Read Safety tips before meeting.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "how-to-ship-an-order",
    title: "How do I ship an order on Reswell?",
    description:
      "Pack the item, print a Reswell label or add your own tracking, and ship within the expected window.",
    audience: "seller",
    intentTags: ["shipping", "sale"],
    keywords: ["ship", "label", "tracking", "pack", "shipengine", "estimator"],
    relatedIds: [
      "selling/i-sold-an-item-whats-next",
      "selling/we-buy-shipping-and-boxes",
      "buying/package-delayed-or-lost",
    ],
    quickAnswer:
      "Open the sale, pack the item, and print the Reswell label if one was purchased at checkout — or add your own tracking. Ship within 7 days of confirmation. Use the shipping estimator and Shipping guide for box sizes and packing.",
    sections: [
      {
        heading: "Reswell labels",
        text: "When the listing used Reswell-calculated rates, checkout buys the cheapest carrier label and attaches tracking. On the sale page, Open label PDF or Print label, then drop the package and mark it dropped off.",
      },
      {
        heading: "Your own label",
        text: "If you used a flat rate or your own carrier, buy a tracked label yourself. Add tracking on the sale page so the buyer and Purchase Protection have a record. Credit card-only or untracked shipments are harder to protect.",
      },
      {
        heading: "Packing and timing",
        text: `Use a proper board box for surfboards. A New Earth Project makes sustainable board boxes — details are on the Shipping guide. Compare quotes with /shipping-estimator before you list. Ship within ${SHIPPING_DEADLINE_DAYS} days. Message the buyer if you are running behind.`,
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "how-long-to-get-paid",
    title: "How long does it take to get paid?",
    description:
      "When your Reswell sale earnings move from pending to ready, and how long bank cash outs take.",
    audience: "seller",
    intentTags: ["payouts", "wallet", "payments"],
    keywords: ["paid", "payout", "timing", "pending", "ready"],
    relatedIds: [
      "selling/i-sold-an-item-whats-next",
      "accounts/how-cash-outs-work",
      "selling/marketplace-fees",
    ],
    quickAnswer:
      "Earnings stay Pending until tracked delivery is confirmed (Reswell releases 24 hours after carrier delivery) or pickup is verified. Ready balance can be spent or cashed out. Standard ACH takes about 2 to 3 business days. Instant transfer may be available for a fee.",
    sections: [
      {
        heading: "Pending vs ready",
        text: "Pending holds earnings until the order clears Purchase Protection timelines. Ready to transfer can be spent at checkout or cashed out.",
      },
      {
        heading: "What can hold a payout",
        text: "No tracking yet, carrier has not reported delivery, pickup code not verified, or an open Purchase Protection claim or refund.",
      },
      {
        heading: "Cashing out",
        text: "Tap Cash out in Earnings. Standard (free) ACH is typically 2 to 3 business days. Instant may be available for a fee depending on your bank and Stripe.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "marketplace-fees",
    title: "What are Reswell's selling fees?",
    description:
      "Reswell charges a 7% marketplace fee on the item price. Here is exactly what you keep and what Reswell covers.",
    audience: "seller",
    intentTags: ["payments", "sale"],
    keywords: ["fees", "commission", "7%", "marketplace fee"],
    relatedIds: ["selling/how-long-to-get-paid", "selling/how-to-list-a-board", "selling/seller-returns"],
    quickAnswer: `On completed sales, Reswell takes ${MARKETPLACE_FEE_PERCENT}% of the item price only. You keep ${SELLER_SHARE_PERCENT}%. Shipping paid by the buyer goes to the carrier and is not part of the fee. Card processing is absorbed by Reswell. Listing is free.`,
    sections: [
      {
        heading: "The marketplace fee",
        text: `Fee is ${MARKETPLACE_FEE_PERCENT}% of item price (list or accepted offer), not shipping. The sale page shows Item price, Platform fee, and Your earnings.`,
      },
      {
        heading: "What is not deducted from you",
        text: "Buyer-paid shipping is not yours and is not fee'd. Stripe card processing is not taken out on top of the marketplace fee. Purchase Protection is funded from the marketplace fee — no separate seller protection charge.",
      },
      {
        heading: "Listing is free",
        text: "Creating and maintaining listings costs nothing. The fee applies only when a sale completes through Reswell checkout.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "respond-to-offers",
    title: "How do I respond to messages and offers?",
    description:
      "Accept, counter, or decline buyer offers on Reswell from Messages or your Offers dashboard.",
    audience: "seller",
    intentTags: ["offers", "messages", "buying_selling"],
    keywords: ["offers", "messages", "counter", "accept", "decline"],
    relatedIds: ["buying/how-do-offers-work", "selling/how-to-list-a-board", "accounts/where-are-messages"],
    quickAnswer:
      "Buyer messages land in Messages. Offers also show on Offers under On my listings. Tap Respond to offer to accept, counter (up to three counters), or decline. Offers expire in 48 hours.",
    sections: [
      {
        heading: "Where offers appear",
        text: "Messages and /dashboard/offers under On my listings. Each tile shows amount, status, and expiry. General questions (not offers) are Messages only.",
      },
      {
        heading: "Responding",
        text: "Accept so the buyer can check out at that price. Counter with a different price and optional note. Decline to end that negotiation. Respond before Expires.",
      },
      {
        heading: "Tips",
        text: "Reply quickly. Clarify shipping or pickup before accepting a low offer. You can send a seller-initiated offer from a message thread. The minimum offer floor is set when you create the listing, typically around 70% of list.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "seller-returns",
    title: "How do returns work for sellers on Reswell?",
    description:
      "What happens when a buyer opens a return or Purchase Protection claim on your sale, and how to cooperate.",
    audience: "seller",
    intentTags: ["returns", "protection", "sale"],
    keywords: ["return", "refund", "seller", "claim"],
    relatedIds: ["selling/cancel-order-seller", "buying/purchase-protection-claim", "selling/marketplace-fees"],
    quickAnswer:
      "Buyers open Get help for not received, not as described, or transit damage. Reswell typically reviews claims within 3 business days. Approved refunds come from the purchase amount, including the marketplace fee. Stay responsive in Messages.",
    sections: [
      {
        heading: "When a buyer opens a claim",
        text: "You will be notified and may need to cooperate or confirm a return arrived. Delays extend resolution.",
      },
      {
        heading: "How refunds affect sellers",
        text: "Approved refunds come from the purchase amount, including Reswell's fee. No extra protection fee. For not-as-described or damage on shipped orders, Reswell may provide a prepaid return label. Your obligation completes when you confirm you received the return.",
      },
      {
        heading: "Return policy basics",
        text: "U.S. buyers may also qualify for returns within 7 calendar days of delivery on eligible purchases. No exchanges, no restocking fee. Local pickup sales are not covered by Purchase Protection claims. Accurate listings prevent most disputes.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "cancel-order-seller",
    title: "How do I cancel an order?",
    description:
      "What to do when you cannot fulfill a Reswell sale and need to cancel or request a refund through support.",
    audience: "seller",
    intentTags: ["sale", "purchase"],
    keywords: ["cancel", "order", "cannot ship"],
    relatedIds: [
      "selling/seller-returns",
      "selling/i-sold-an-item-whats-next",
      "buying/get-help-with-a-purchase",
    ],
    quickAnswer:
      "Do not ship an order you intend to cancel. Message the buyer, open the sale, tap Get help with this sale, and submit a cancel request. Buyers can also ask to cancel from their purchase page before it ships.",
    sections: [
      {
        heading: "When you need to cancel",
        text: "Item damaged, sold elsewhere, or pickup cannot be coordinated. Contact the buyer and support as soon as you know.",
      },
      {
        heading: "How to request a cancellation",
        text: "Message the buyer. Open Sales, tap Get help with this sale, choose cancel, and explain (at least 10 characters). Track the case under Support.",
      },
      {
        heading: "Late shipping",
        text: `Ship within ${SHIPPING_DEADLINE_DAYS} days when you can. If you are behind, message the buyer. Buyers can contact support from the purchase page.`,
      },
    ],
  }),
  retrievalDoc({
    topicId: "selling",
    slug: "leave-feedback-buyer",
    title: "How do I leave feedback for a buyer?",
    description: "Review a buyer after a completed sale. Reswell asks the buyer to review you automatically.",
    audience: "seller",
    intentTags: ["reviews", "sale"],
    keywords: ["feedback", "review", "buyer", "rating"],
    relatedIds: ["buying/leave-seller-review", "selling/i-sold-an-item-whats-next"],
    quickAnswer:
      "After a sale completes, open Sales and tap Review buyer. Reswell automatically emails the buyer a review request — you do not need to send one. A buyer's positive review can close their Purchase Protection window early.",
    sections: [
      {
        heading: "Leaving a buyer review",
        text: "Reswell emails you after the sale. Open the order and tap Review buyer for a star rating and comment. Keep it factual.",
      },
      {
        heading: "Asking the buyer for a review",
        text: "Once delivery or pickup is complete, Reswell sends a review request in Messages and email. You do not need to tap anything.",
      },
      {
        heading: "Why reviews matter",
        text: "Buyers check seller history before they buy. A buyer's positive review can close their protection window early on that order.",
      },
    ],
  }),
]
