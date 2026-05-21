import type { HelpArticle } from "@/lib/help-center/types"
import { SHIPPING_DEADLINE_DAYS } from "@/lib/shipping-deadline"
import {
  BulletList,
  HelpNote,
  NumberedSteps,
  helpFigure,
  helpLink,
} from "@/lib/help-center/content-helpers"

export const buyingHelpArticles: HelpArticle[] = [
  {
    slug: "how-do-i-buy-a-board",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Browsing and checkout",
    title: "How do I buy a board on Reswell?",
    description:
      "Find a surfboard you love, check out with Buy it now, and stay covered by Purchase Protection. You can also message the seller or make an offer first.",
    keywords: ["buy", "checkout", "purchase", "board"],
    relatedSlugs: ["local-pickup-or-shipping", "how-do-i-pay", "how-do-offers-work"],
    quickAnswer: (
      <>
        Browse {helpLink("/boards", "Surfboards")}, open a listing, and tap <strong>Buy it now</strong> to
        check out in Reswell. You can also <strong>Message Seller</strong> first or{" "}
        <strong>Make an offer</strong> when the seller has offers turned on. Just keep payment inside
        Reswell checkout.
      </>
    ),
    sections: [
      {
        heading: "Find a board",
        body: (
          <>
            <p>
              Start on the {helpLink("/boards", "Surfboards")} page or use search to filter by brand,
              length, fin setup, and price. Tap any active listing to see photos, dimensions, condition
              notes, and how the seller can get the board to you.
            </p>
            <p>
              See something you like? Tap the heart to save it to {helpLink("/favorites", "Favorites")}{" "}
              and come back when you are ready.
            </p>
          </>
        ),
        figure: helpFigure(
          "browse-boards.png",
          "Surfboards browse page with filters and listing grid on Reswell",
          "Browse boards by type, location, and price from the Surfboards page.",
        ),
      },
      {
        heading: "Buy it now",
        body: (
          <>
            <p>
              When you are ready, tap <strong>Buy it now</strong> on the listing. Checkout is where you
              pick how you will get the board (if the seller offers both pickup and shipping), confirm
              your details, and pay through Stripe.
            </p>
            <NumberedSteps
              steps={[
                {
                  title: "Sign in",
                  body: "You need a Reswell account so we can connect your purchase to Purchase Protection and your order history.",
                },
                {
                  title: "Choose how you will get the board",
                  body: (
                    <>
                      Pick <strong>Local pickup</strong> to meet the seller in person, or{" "}
                      <strong>Ship to me</strong> when shipping is available. Our guide on{" "}
                      {helpLink("/help/buying/local-pickup-or-shipping", "pickup vs shipping")} walks
                      through each option.
                    </>
                  ),
                },
                {
                  title: "Pay in checkout",
                  body: (
                    <>
                      Review your order and tap <strong>Pay now</strong>. You can pay by card, Link, or
                      Klarna through Stripe. More on{" "}
                      {helpLink("/help/buying/how-do-i-pay", "payment methods")}.
                    </>
                  ),
                },
                {
                  title: "Track your purchase",
                  body: (
                    <>
                      After you pay, open {helpLink("/dashboard/purchases", "Purchases")} to follow
                      shipping, coordinate pickup, or get help if something goes wrong.
                    </>
                  ),
                },
              ]}
            />
          </>
        ),
        figure: helpFigure(
          "listing-detail.png",
          "Listing page showing Buy it now, Add to cart, and Make an offer buttons",
          "Tap Buy it now to check out, or Make an offer if the seller has offers enabled.",
        ),
      },
      {
        heading: "Not ready to buy yet?",
        body: (
          <>
            <p>
              Tap <strong>Message Seller</strong> in the About Seller section to ask about dings, fin
              setup, or pickup timing. If the seller has offers on, tap <strong>Make an offer</strong>{" "}
              to negotiate. Read{" "}
              {helpLink("/help/buying/how-do-offers-work", "How do offers work on Reswell?")} for the
              full rundown.
            </p>
            <HelpNote>
              Keep every conversation and payment on Reswell. If you pay outside the app, Purchase
              Protection does not apply. See our{" "}
              {helpLink("/protection-policy", "Purchase Protection")} page for details.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "how-do-offers-work",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Offers",
    title: "How do offers work on Reswell?",
    description:
      "Make an offer on a surfboard, respond to counteroffers, and check out at the price you and the seller agree on.",
    keywords: ["offer", "counter", "negotiate"],
    relatedSlugs: ["how-do-i-buy-a-board", "how-long-to-pay", "how-to-contact-a-seller"],
    quickAnswer: (
      <>
        When a seller has offers on, tap <strong>Make an offer</strong> on the listing. They can accept,
        counter, or decline in Messages. Once you agree on a price, go back to the listing and tap{" "}
        <strong>Buy it now</strong>.
      </>
    ),
    sections: [
      {
        heading: "When you can make an offer",
        body: (
          <>
            <p>
              Offers work on active surfboard listings when the seller has turned them on. You can have
              one open offer per board at a time. Most sellers set a minimum around 70% of the list
              price, and the Make an Offer dialog shows you the floor before you submit.
            </p>
            <BulletList
              items={[
                <>Pick <strong>Shipped</strong> or <strong>Local pickup</strong> in the offer dialog.</>,
                <>Enter your offer or tap a quick discount like <strong>5% off</strong> or <strong>10% off</strong>.</>,
                <>Add a short note to the seller if you want (up to 200 characters).</>,
                <>Tap <strong>Submit offer</strong>. The seller has 48 hours to respond before it expires.</>,
              ]}
            />
          </>
        ),
        figure: helpFigure(
          "listing-detail.png",
          "Make an offer button on a surfboard listing page",
          "Make an offer appears on listings when the seller has offers turned on.",
        ),
      },
      {
        heading: "What happens after you submit",
        body: (
          <>
            <p>
              Your offer shows up in {helpLink("/messages", "Messages")} and on{" "}
              {helpLink("/dashboard/offers", "Offers")} under <strong>I made</strong>. From there the
              seller can:
            </p>
            <BulletList
              items={[
                <><strong>Accept</strong> your offer so you can move on to checkout.</>,
                <><strong>Counter</strong> with a different price (up to three counters per thread).</>,
                <><strong>Decline</strong>, which ends the negotiation. You can submit a new offer later if the listing is still active.</>,
              ]}
            />
            <p>
              If they counter, open the thread and tap <strong>Review counteroffer</strong> to{" "}
              <strong>Accept</strong> or <strong>Decline</strong>. Accepting saves the agreed price for
              checkout. You are not charged until you actually pay.
            </p>
          </>
        ),
      },
      {
        heading: "Paying after an offer is accepted",
        body: (
          <>
            <p>
              Once you agree on a price, go back to the listing and tap <strong>Buy it now</strong>.
              Checkout applies the agreed price automatically. Shipping (if you chose delivery) and any
              taxes get added when you pay.
            </p>
            <HelpNote>
              Do not wait too long. Pay before the deadline in Messages or your email. See{" "}
              {helpLink("/help/buying/how-long-to-pay", "How long do I have to pay?")} for timing
              details.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "local-pickup-or-shipping",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Browsing and checkout",
    title: "How do I know if a listing offers pickup or shipping?",
    description:
      "Every listing shows how you can get the board. Here is how to read those options and what they mean at checkout.",
    keywords: ["pickup", "shipping", "delivery"],
    relatedSlugs: ["how-do-i-buy-a-board", "package-delayed-or-lost", "purchase-protection-claim"],
    sections: [
      {
        heading: "Reading the listing",
        body: (
          <>
            <p>
              Look near the price for labels like <strong>Local pickup</strong>,{" "}
              <strong>Shipping (+$X.XX)</strong>, <strong>Free shipping</strong>, or{" "}
              <strong>Pickup or shipping</strong> when the seller offers both.
            </p>
            <BulletList
              items={[
                <><strong>Local pickup</strong> means you meet the seller in person to inspect and grab the board.</>,
                <><strong>Flat rate shipping</strong> is a fixed amount shown on the listing and in checkout.</>,
                <><strong>Free shipping</strong> means no extra shipping charge. The item price is your total before tax.</>,
                <><strong>Shipping (rate at checkout)</strong> means Reswell calculates the carrier rate from the box size and your address when you check out.</>,
              ]}
            />
          </>
        ),
      },
      {
        heading: "Choosing at checkout",
        body: (
          <>
            <p>
              If the seller offers both, checkout shows a <strong>Delivery method</strong> section. Pick{" "}
              <strong>Local pickup</strong> or <strong>Ship to me</strong>. Pickup only listings skip
              shipping. Shipping only listings need a delivery address.
            </p>
            <p>
              For shipped orders, the seller adds tracking once the board goes out. Follow along from{" "}
              {helpLink("/dashboard/purchases", "Purchases")} and tap <strong>Track package</strong> when
              the carrier link is ready.
            </p>
          </>
        ),
      },
      {
        heading: "Pickup after purchase",
        body: (
          <>
            <p>
              After a pickup purchase is confirmed, you get a pickup code on your purchase page. Message
              the seller to agree on a safe, public spot and time. Inspect the board in person, and share
              your code when you are happy with it.
            </p>
            <HelpNote>
              Read our {helpLink("/safety", "Safety tips")} before meeting anyone in person. Purchase
              Protection requires tracked shipping, so local pickup is not covered by protection claims.
              See {helpLink("/protection-policy", "Purchase Protection")} for the full details.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "how-do-favorites-work",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Search and favorites",
    title: "How do favorites work on Reswell?",
    description:
      "Save boards you are eyeing, compare them later, and jump back to buy when the timing is right.",
    keywords: ["favorite", "save", "wishlist"],
    relatedSlugs: ["how-do-i-buy-a-board", "how-do-offers-work"],
    sections: [
      {
        heading: "Saving a listing",
        body: (
          <>
            <p>
              Tap the heart on any listing to save it. Your saved boards live in{" "}
              {helpLink("/favorites", "Favorites")}, your personal shortlist of boards and gear you are
              thinking about.
            </p>
            <p>
              You need to be signed in to save favorites. Browsing without an account? You will be
              prompted to sign in or create one first.
            </p>
          </>
        ),
        figure: helpFigure(
          "listing-detail.png",
          "Heart icon on a surfboard listing for saving to Favorites",
          "Tap the heart on any listing tile or detail page to save it.",
        ),
      },
      {
        heading: "Managing your list",
        body: (
          <>
            <p>
              Open {helpLink("/favorites", "Favorites")} from the header to see everything you have saved.
              Tap a listing to go back to it, or tap the heart again to remove it.
            </p>
            <BulletList
              items={[
                <>Compare boards before you commit to an offer or purchase.</>,
                <>Check back for price drops or status changes.</>,
                <>Sold listings stay in your list with a sold badge so you can reference them later.</>,
              ]}
            />
          </>
        ),
      },
      {
        heading: "Ready to buy?",
        body: (
          <p>
            Open a saved listing and use <strong>Buy it now</strong>, <strong>Make an offer</strong>, or{" "}
            <strong>Message Seller</strong>, same as any active listing. For the full walkthrough, see{" "}
            {helpLink("/help/buying/how-do-i-buy-a-board", "How do I buy a board on Reswell?")}.
          </p>
        ),
      },
    ],
  },
  {
    slug: "how-do-i-pay",
    topicId: "buying",
    sectionSlug: "checkout",
    sectionTitle: "Checkout",
    groupTitle: "Paying at checkout",
    title: "How do I pay for a purchase?",
    description:
      "Pay securely at checkout with your card through Stripe. We also support Link and Klarna. Off platform payments are not accepted.",
    keywords: ["pay", "card", "checkout", "stripe"],
    relatedSlugs: ["wallet-balance-at-checkout", "how-do-i-buy-a-board", "why-charged-tax"],
    sections: [
      {
        heading: "Supported payment methods",
        body: (
          <>
            <p>
              Reswell checkout runs on Stripe. When you tap <strong>Pay now</strong>, you can pay with:
            </p>
            <BulletList
              items={[
                <>Debit or credit card</>,
                <>Link (Stripe&apos;s saved payment experience)</>,
                <>Klarna (where available)</>,
              ]}
            />
            <p>
              Your card details go straight into Stripe&apos;s secure form. Reswell never stores your
              full card number. Every checkout page links to our{" "}
              {helpLink("/protection-policy", "Purchase Protection")}, Privacy Policy, and Terms of
              Service.
            </p>
          </>
        ),
      },
      {
        heading: "What you pay",
        body: (
          <>
            <p>
              Your order summary shows <strong>Subtotal</strong> (the item price or your accepted offer
              price), <strong>Shipping</strong> when it applies, and <strong>Total</strong> in USD.
              Sales tax may apply depending on where you live. See{" "}
              {helpLink("/help/buying/why-charged-tax", "Why was I charged tax on my order?")}.
            </p>
            <p>
              Promo codes and gift cards are not available for listings from other surfers yet. If you
              have wallet balance from past sales, see{" "}
              {helpLink("/help/buying/wallet-balance-at-checkout", "Can I use wallet balance at checkout?")}.
            </p>
          </>
        ),
      },
      {
        heading: "Payments we do not accept",
        body: (
          <>
            <p>
              Every purchase needs to go through Reswell checkout. We do not accept Venmo, PayPal, cash,
              wire transfers, or anything paid outside the app.
            </p>
            <HelpNote>
              Off platform payments are not covered by {helpLink("/protection-policy", "Purchase Protection")}.
              If a seller asks you to pay elsewhere, report the listing and{" "}
              {helpLink("/contact", "contact support")}.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "wallet-balance-at-checkout",
    topicId: "buying",
    sectionSlug: "checkout",
    sectionTitle: "Checkout",
    groupTitle: "Paying at checkout",
    title: "Can I use wallet balance at checkout?",
    description:
      "Your wallet holds earnings from past sales. Here is how it works and how it connects to checkout and cash outs.",
    keywords: ["wallet", "balance"],
    relatedSlugs: ["how-do-i-pay", "how-do-i-buy-a-board"],
    sections: [
      {
        heading: "What is wallet balance?",
        body: (
          <p>
            Your wallet holds earnings from completed sales on Reswell. After a sale clears through
            Purchase Protection timelines, the funds show up in{" "}
            {helpLink("/dashboard/earnings", "Earnings")}. You can spend that balance on other listings
            or cash out to your bank.
          </p>
        ),
      },
      {
        heading: "Using balance toward a purchase",
        body: (
          <>
            <p>
              If you have balance from past sales, you may be able to apply it when you buy another
              board on Reswell. Standard checkout also takes card payment through Stripe when your
              balance does not cover the full amount.
            </p>
            <p>
              Check your balance anytime in {helpLink("/dashboard/earnings", "Earnings")}. Questions
              about a specific purchase? {helpLink("/contact", "Contact support")} with your order
              details.
            </p>
          </>
        ),
      },
      {
        heading: "Cash outs and refunds",
        body: (
          <>
            <p>
              To move wallet funds to your bank, request a cash out from Earnings once your payout
              destination is connected and verified. Timing depends on your bank and any identity
              checks.
            </p>
            <HelpNote>
              Refunds on wallet paid orders go back to your wallet. Card refunds return to your card
              through Stripe, usually within 5 to 10 business days.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "buyer-returns",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Returns and refunds",
    title: "How do returns work for buyers on Reswell?",
    description:
      "How to return a board, file a Purchase Protection claim, and start a refund request from your purchase page.",
    keywords: ["return", "refund"],
    relatedSlugs: ["purchase-protection-claim", "how-to-contact-a-seller", "package-delayed-or-lost"],
    quickAnswer: (
      <>
        For covered problems on shipped orders, tap <strong>Refund help</strong> on your purchase page
        or file a {helpLink("/protection-policy", "Purchase Protection")} claim. Qualifying returns
        need to start within 7 calendar days of delivery for U.S. buyers.
      </>
    ),
    sections: [
      {
        heading: "Return policy overview",
        body: (
          <>
            <p>
              Our {helpLink("/return-policy", "Return Policy")} applies to eligible U.S. purchases
              through Reswell checkout. Here is what to know:
            </p>
            <BulletList
              items={[
                <>We accept returns for defective and non defective products when you meet the eligibility requirements.</>,
                <>We do not do exchanges. If something does not work out, start a qualifying return for a refund.</>,
                <>Start your return within <strong>7 calendar days of delivery</strong> for shipped purchases.</>,
                <>No restocking fee. Reswell provides a prepaid return label when one is needed.</>,
                <>Refunds usually process within about 7 days after we receive and confirm the return.</>,
              ]}
            />
          </>
        ),
      },
      {
        heading: "Purchase Protection vs. returns",
        body: (
          <>
            <p>
              {helpLink("/protection-policy", "Purchase Protection")} handles specific problems on
              eligible checkout purchases: the item never arrives, it is materially different from the
              listing, or it arrives damaged in transit. That is separate from buyer&apos;s remorse.
              You can file protection claims within <strong>30 days of confirmed delivery</strong>.
            </p>
            <p>
              Defective or quality issues on shipped orders usually go through Purchase Protection. The
              return policy covers broader qualifying returns within the 7 day window. Local pickup
              only purchases may not qualify for checkout backed returns.
            </p>
          </>
        ),
      },
      {
        heading: "How to start a return or refund request",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Message the seller first",
                body: (
                  <>
                    Open the purchase thread and explain what is going on. A lot of issues get sorted
                    quickly when you talk directly. See{" "}
                    {helpLink("/help/buying/how-to-contact-a-seller", "How to contact a seller")}.
                  </>
                ),
              },
              {
                title: "Open Refund help",
                body: (
                  <>
                    Go to {helpLink("/dashboard/purchases", "Purchases")}, open your order, and tap{" "}
                    <strong>Refund help</strong>. Tell us if you already contacted the seller, then
                    describe what happened.
                  </>
                ),
              },
              {
                title: "Submit to support",
                body: (
                  <>
                    Tap <strong>Submit to support</strong>. We usually review Purchase Protection
                    claims within <strong>3 business days</strong>. Include tracking numbers, delivery
                    dates, and photos when you have them.
                  </>
                ),
              },
            ]}
          />
        ),
      },
    ],
  },
  {
    slug: "purchase-protection-claim",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Returns and refunds",
    title: "How am I protected if I do not receive an item or it is not as described?",
    description:
      "What Purchase Protection covers, what it does not, and how to file a claim from your purchase page.",
    keywords: ["protection", "claim", "dispute"],
    relatedSlugs: ["buyer-returns", "package-delayed-or-lost", "local-pickup-or-shipping"],
    quickAnswer: (
      <>
        {helpLink("/protection-policy", "Purchase Protection")} covers eligible checkout purchases when
        an item never arrives, shows up damaged, or is clearly different from the listing. There is no
        extra fee. It is included on eligible orders.
      </>
    ),
    sections: [
      {
        heading: "What Purchase Protection covers",
        body: (
          <>
            <p>
              Every eligible purchase paid through Reswell checkout includes Purchase Protection at no
              extra cost. When we approve a covered claim, you get a full refund of the item price and
              shipping you paid.
            </p>
            <BulletList
              items={[
                <><strong>Item never arrives.</strong> Tracking confirms it did not get delivered. You get a full refund and do not need to return anything.</>,
                <><strong>Not as described.</strong> The board is materially different from the listing (wrong size, hidden damage, wrong model). Full refund plus a prepaid return label. Your refund releases after the seller confirms they got it back.</>,
                <><strong>Arrives damaged.</strong> Transit damage with photo evidence. Same process as not as described claims.</>,
              ]}
            />
          </>
        ),
        figure: helpFigure(
          "purchase-protection.png",
          "Reswell Purchase Protection policy page",
          "Full coverage details and claim instructions are on the Purchase Protection page.",
        ),
      },
      {
        heading: "What is not covered",
        body: (
          <>
            <BulletList
              items={[
                <>Buyer&apos;s remorse or change of mind</>,
                <>Subjective stuff, like the board not riding the way you hoped</>,
                <>Damage that happens after you receive the item</>,
                <><strong>Local pickup</strong> transactions</>,
                <>Payments made outside Reswell checkout</>,
                <>Claims filed more than 30 days after confirmed delivery</>,
              ]}
            />
            <HelpNote>
              Leaving a positive review closes your protection window early, even before the 30 day
              period ends. Read the full policy at{" "}
              {helpLink("/protection-policy", "Purchase Protection")}.
            </HelpNote>
          </>
        ),
      },
      {
        heading: "How to file a claim",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Open your purchase",
                body: (
                  <>
                    Go to {helpLink("/dashboard/purchases", "Purchases")} and select the order. Claims
                    are available when the purchase status is confirmed.
                  </>
                ),
              },
              {
                title: "Tap Refund help",
                body: "Tell us if you already messaged the seller, then describe the issue with as much detail as you can: tracking numbers, delivery dates, and what is different from the listing.",
              },
              {
                title: "Wait for review",
                body: "We typically review claims within 3 business days. If approved, refunds go back to your original payment method (card via Stripe, or wallet balance for wallet paid orders).",
              },
            ]}
          />
        ),
      },
    ],
  },
  {
    slug: "package-delayed-or-lost",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Order issues",
    title: "What should I do if my package is delayed or lost?",
    description:
      "Your order is late, tracking has stalled, or the package never showed up. Here is what to do, step by step.",
    keywords: ["delayed", "lost", "tracking"],
    relatedSlugs: ["purchase-protection-claim", "how-to-contact-a-seller", "change-shipping-address"],
    sections: [
      {
        heading: "Check tracking first",
        body: (
          <>
            <p>
              Open your order in {helpLink("/dashboard/purchases", "Purchases")}. If the seller has
              shipped, you will see a tracking number and a <strong>Track package</strong> link. Carrier
              scans sometimes lag a day or two after the label is created. That is normal.
            </p>
            <p>
              Your purchase page walks through the journey: purchase confirmed, shipped, in transit,
              then confirm delivery. Tap <strong>I received my item</strong> once the board arrives.
            </p>
          </>
        ),
      },
      {
        heading: "If the seller has not shipped yet",
        body: (
          <>
            <p>
              Sellers have <strong>{SHIPPING_DEADLINE_DAYS} days</strong> from purchase confirmation to
              ship your board. Your purchase page shows the deadline and how many days are left.
            </p>
            <p>
              If they miss that deadline, Reswell cancels the order and refunds you automatically. You
              do not need to file a claim. Feel free to message the seller in the meantime if you want
              a status update.
            </p>
          </>
        ),
      },
      {
        heading: "Delayed or lost after shipping",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Message the seller",
                body: "Share the tracking number and ask if the carrier has updated anything. Sometimes a facility delay clears up in a few days.",
              },
              {
                title: "Check with the carrier",
                body: "Use the Track package link on your purchase page. Look for delivery exceptions or return to sender notices.",
              },
              {
                title: "File a Purchase Protection claim",
                body: (
                  <>
                    If tracking shows the package is lost or has not moved in a long time, open{" "}
                    <strong>Refund help</strong> on your purchase page. Eligible non delivery claims on
                    tracked shipments are covered by{" "}
                    {helpLink("/protection-policy", "Purchase Protection")}. Our{" "}
                    {helpLink("/shipping", "Shipping guide")} has more detail.
                  </>
                ),
              },
            ]}
          />
        ),
      },
    ],
  },
  {
    slug: "change-shipping-address",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Order issues",
    title: "How can I change the shipping address on my purchase?",
    description:
      "Need to update your delivery address? Here is how to do it before the seller ships, and what to do if a label is already printed.",
    keywords: ["address", "shipping"],
    relatedSlugs: ["how-to-contact-a-seller", "package-delayed-or-lost"],
    sections: [
      {
        heading: "Act quickly",
        body: (
          <p>
            You can only change the address before the seller buys a shipping label. Once a label exists,
            the carrier may not allow changes. The seller might need to void it and print a new one.
          </p>
        ),
      },
      {
        heading: "Steps to change your address",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Message the seller right away",
                body: (
                  <>
                    Open the purchase thread from {helpLink("/dashboard/purchases", "Purchases")} or{" "}
                    {helpLink("/messages", "Messages")} and tap <strong>Message seller</strong>. Send
                    your corrected address with apartment or unit number, city, state, and ZIP.
                  </>
                ),
              },
              {
                title: "Confirm they got it",
                body: "Ask the seller to confirm they can update the address before shipping. Most can, as long as no label has been purchased yet.",
              },
              {
                title: "Contact support if needed",
                body: (
                  <>
                    If the seller already shipped to the wrong address or cannot make the change,{" "}
                    {helpLink("/contact", "contact Reswell support")} with your order number and both
                    the old and new addresses.
                  </>
                ),
              },
            ]}
          />
        ),
      },
      {
        heading: "Avoid address mistakes",
        body: (
          <>
            <p>
              Double check your delivery address in checkout before you tap <strong>Pay now</strong>.
              You can save addresses and pick <strong>Use a different address</strong> on future orders.
            </p>
            <HelpNote>
              Once the carrier has your package, we cannot redirect it. Catching address errors before
              the seller ships saves everyone a headache.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "how-to-contact-a-seller",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Contacting your seller",
    title: "How to contact a seller",
    description:
      "Every way to reach a seller on Reswell, and why keeping the conversation on the platform helps if something goes wrong.",
    keywords: ["message", "seller", "contact"],
    relatedSlugs: ["how-do-offers-work", "change-shipping-address", "buyer-returns"],
    sections: [
      {
        heading: "Where to start a conversation",
        body: (
          <>
            <p>You can message a seller from a few places:</p>
            <BulletList
              items={[
                <>
                  On the <strong>listing page</strong>, tap <strong>Message Seller</strong> in the About
                  Seller section.
                </>,
                <>
                  On your <strong>purchase page</strong>, tap <strong>Message seller</strong> from{" "}
                  {helpLink("/dashboard/purchases", "Purchases")} to talk about shipping, pickup, or
                  order issues.
                </>,
                <>
                  In your <strong>Messages inbox</strong>, open {helpLink("/messages", "Messages")} from
                  the header to see all threads.
                </>,
                <>
                  From <strong>Offers</strong>, negotiations live in Messages and on{" "}
                  {helpLink("/dashboard/offers", "Offers")}. Tap <strong>Messages</strong> on any offer
                  to jump to the thread.
                </>,
              ]}
            />
          </>
        ),
      },
      {
        heading: "What to use Messages for",
        body: (
          <BulletList
            items={[
              <>Ask about condition, fin setup, or dimensions before you buy.</>,
              <>Coordinate pickup time and where to meet.</>,
              <>Request an address change before the seller ships.</>,
              <>Let them know about a delivery delay or a problem with your order.</>,
              <>Accept, decline, or negotiate offer counters in the thread.</>,
            ]}
          />
        ),
      },
      {
        heading: "Keep it on Reswell",
        body: (
          <>
            <p>
              Keep purchase related conversations inside Reswell Messages. Our support team can only
              review on platform threads when you file a claim or need help with a dispute.
            </p>
            <HelpNote>
              Be careful if a seller asks you to pay outside the app, move to text only, or share
              financial info. Report suspicious behavior and read our {helpLink("/safety", "Safety tips")}.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "how-long-to-pay",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Order issues",
    title: "How long do I have to pay for my Reswell purchase?",
    description:
      "When to complete checkout, how long offers stay open, and what to do after a seller accepts your offer.",
    keywords: ["pay", "deadline", "checkout"],
    relatedSlugs: ["how-do-offers-work", "how-do-i-pay", "how-do-i-buy-a-board"],
    sections: [
      {
        heading: "Buy it now purchases",
        body: (
          <>
            <p>
              When you tap <strong>Buy it now</strong>, finish checkout as soon as you can. The listing
              stays available to other buyers until your payment goes through. Someone else could buy
              it if you leave checkout open.
            </p>
            <p>
              You need to be signed in. Have your address and payment ready so you can tap{" "}
              <strong>Pay now</strong> without scrambling.
            </p>
          </>
        ),
      },
      {
        heading: "Offer deadlines",
        body: (
          <>
            <p>
              Offers expire <strong>48 hours</strong> after you submit them, unless the seller responds
              sooner. You will see the countdown in {helpLink("/messages", "Messages")} and on{" "}
              {helpLink("/dashboard/offers", "Offers")}.
            </p>
            <BulletList
              items={[
                <>If the seller counters, accept or decline before the offer expires.</>,
                <>Expired offers show as <strong>Expired</strong>. You can submit a new one if the listing is still active.</>,
                <>When a seller accepts, the agreed price is locked in for checkout.</>,
              ]}
            />
          </>
        ),
      },
      {
        heading: "Paying after an accepted offer",
        body: (
          <>
            <p>
              After you agree on a price, go back to the listing and tap <strong>Buy it now</strong>.
              Checkout may show a banner with your accepted offer amount. Shipping, if it applies, gets
              added when you pay.
            </p>
            <HelpNote>
              Do not sit on it too long. The listing can still sell to someone else at list price if
              you wait. Check Messages and your email for deadline reminders.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "why-charged-tax",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Order issues",
    title: "Why was I charged tax on my order?",
    description:
      "When sales tax applies on Reswell purchases and where to see it on your order.",
    keywords: ["tax", "sales tax"],
    relatedSlugs: ["how-do-i-pay", "how-do-i-buy-a-board"],
    sections: [
      {
        heading: "When sales tax applies",
        body: (
          <>
            <p>
              Reswell may collect sales tax when state and local law requires it. It depends on your
              delivery address, the item, and applicable marketplace tax rules.
            </p>
            <p>
              Tax is based on the item price plus shipping when shipping applies. The exact amount, if
              any, is calculated at checkout from your order details.
            </p>
          </>
        ),
      },
      {
        heading: "Where to see tax on your order",
        body: (
          <>
            <p>
              Your cart shows <strong>Tax: Calculated at checkout</strong> before you pay. Review the
              full total on the checkout page before you tap <strong>Pay now</strong>.
            </p>
            <p>
              After purchase, your confirmation and purchase page in{" "}
              {helpLink("/dashboard/purchases", "Purchases")} show the final amount you paid, including
              any tax.
            </p>
          </>
        ),
      },
      {
        heading: "Questions about a specific charge",
        body: (
          <>
            <p>
              Tax seem off? Double check your delivery address. Rates vary by state and city. Offer
              totals during negotiation are before tax. The final amount is set when you pay.
            </p>
            <p>
              Need help with a specific order? {helpLink("/contact", "Contact Reswell support")} with
              your order number and we will walk through the charge with you.
            </p>
          </>
        ),
      },
    ],
  },
]
