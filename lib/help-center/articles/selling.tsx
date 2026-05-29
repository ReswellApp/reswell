import type { HelpArticle } from "@/lib/help-center/types"
import { SHIPPING_DEADLINE_DAYS } from "@/lib/shipping-deadline"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"
import {
  BulletList,
  HelpNote,
  NumberedSteps,
  helpFigure,
  helpLink,
} from "@/lib/help-center/content-helpers"

export const sellingHelpArticles: HelpArticle[] = [
  {
    slug: "how-to-list-a-board",
    topicId: "selling",
    sectionSlug: "listings",
    sectionTitle: "Listings",
    groupTitle: "Creating listings",
    title: "How do I list a board for sale?",
    description:
      "Create a surfboard listing on Reswell with photos, board details, pickup or shipping options, and your price. Listing is free.",
    keywords: ["list", "sell", "post"],
    relatedSlugs: ["listing-photos-and-pricing", "edit-or-remove-listing", "i-sold-an-item-whats-next"],
    quickAnswer: (
      <>
        Tap {helpLink("/sell", "Sell")}, add photos and board details, choose pickup and/or shipping,
        set your price, and hit <strong>Create Listing</strong>. You can turn on offers to let buyers
        negotiate before checkout.
      </>
    ),
    sections: [
      {
        heading: "Getting started",
        body: (
          <>
            <p>
              Sign in and go to {helpLink("/sell", "Sell")}. The flow walks you through four sections:
              Title &amp; photos, Board &amp; description, Pickup &amp; shipping, and Price &amp;
              publish. You can save a draft and come back later.
            </p>
            <p>
              Already have a listing? Edit it anytime from{" "}
              {helpLink("/dashboard/listings", "My Listings")}.
            </p>
          </>
        ),
        figure: helpFigure(
          "sign-in.png",
          "Reswell sign in page",
          "Sign in to access the sell flow and manage your listings.",
        ),
      },
      {
        heading: "What to include",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Title and photos",
                body: (
                  <>
                    Add a clear title (up to 60 characters) and at least one photo. You can upload up
                    to 12. Drag to reorder. Good photos sell boards. See{" "}
                    {helpLink("/help/selling/listing-photos-and-pricing", "Tips for photos and pricing")}.
                  </>
                ),
              },
              {
                title: "Board details",
                body: "Pick the board shape, condition, brand, model, and dimensions. Write an honest description (up to 1,000 characters). You can use the AI helper to draft or polish your copy.",
              },
              {
                title: "Pickup and shipping",
                body: (
                  <>
                    Set your location on the map, then choose <strong>Shipping</strong>,{" "}
                    <strong>Local pickup</strong>, or both. For shipping, pick Reswell calculated
                    rates, free shipping, or a flat rate. See our{" "}
                    {helpLink("/shipping", "Shipping guide")}.
                  </>
                ),
              },
              {
                title: "Price and publish",
                body: (
                  <>
                    Enter your listing price. Optional: enable <strong>Drop the price in 2 weeks</strong>{" "}
                    or <strong>Allow buyers to make offers</strong> to negotiate before checkout. Tap{" "}
                    <strong>Create Listing</strong> or <strong>Publish listing</strong> when you are
                    ready.
                  </>
                ),
              },
            ]}
          />
        ),
      },
      {
        heading: "After you publish",
        body: (
          <>
            <p>
              Your board goes live on {helpLink("/boards", "Surfboards")}. Buyers can favorite it,
              message you, make an offer (if enabled), or buy at your list price. Manage everything
              from {helpLink("/dashboard/listings", "My Listings")}.
            </p>
            <HelpNote>
              Listing on Reswell is free. Reswell takes a {MARKETPLACE_FEE_PERCENT}% marketplace fee
              only when a sale completes. See{" "}
              {helpLink("/help/selling/marketplace-fees", "What are Reswell's selling fees?")}.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "listing-photos-and-pricing",
    topicId: "selling",
    sectionSlug: "listings",
    sectionTitle: "Listings",
    groupTitle: "Creating listings",
    title: "Tips for photos and pricing your board",
    description:
      "Take photos that sell your board and price it fairly against similar listings and recent sales on Reswell.",
    keywords: ["photos", "price", "listing"],
    relatedSlugs: ["how-to-list-a-board", "marketplace-fees", "respond-to-offers"],
    sections: [
      {
        heading: "Photos that help your board sell",
        body: (
          <>
            <p>
              Buyers cannot pick up the board in a shop. Your photos do the talking. A few things
              that work well:
            </p>
            <BulletList
              items={[
                <>Shoot in natural light, outdoors or near a window.</>,
                <>Show the whole board: deck, bottom, rails, nose, and tail.</>,
                <>Include close ups of dings, pressure dents, and yellowing. Honesty builds trust.</>,
                <>Add fin setup shots if fins are included.</>,
                <>Upload up to 12 photos and drag them into the order you want buyers to see first.</>,
              ]}
            />
          </>
        ),
      },
      {
        heading: "Pricing your board",
        body: (
          <>
            <p>
              Check {helpLink("/sold", "Recently sold")} for similar boards: same brand, length, and
              condition. Price a little high if you expect offers, or set a firm price if you want
              a quick sale.
            </p>
            <BulletList
              items={[
                <>Factor in shipping if you charge for it. Free shipping can help a listing stand out.</>,
                <>Remember Reswell takes {MARKETPLACE_FEE_PERCENT}% of the item price at sale. You keep {SELLER_SHARE_PERCENT}%.</>,
                <>Use <strong>Drop the price in 2 weeks</strong> if you want an automatic price cut after two weeks.</>,
                <>Turn on offers if you are open to negotiating. Most sellers set a minimum around 70% of list price.</>,
              ]}
            />
          </>
        ),
      },
      {
        heading: "Writing a description buyers trust",
        body: (
          <>
            <p>
              Mention how long you have owned the board, how often you rode it, and any repairs or
              modifications. Call out fin setup, volume, and whether fins are included.
            </p>
            <p>
              The AI description helper can get you started, but read it over before publishing.
              Buyers notice when a listing feels generic or skips over wear and tear.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "edit-or-remove-listing",
    topicId: "selling",
    sectionSlug: "listings",
    sectionTitle: "Listings",
    groupTitle: "Managing listings",
    title: "How do I edit or remove a listing?",
    description:
      "Update a live listing, mark a board as sold, or end a listing from My Listings on Reswell.",
    keywords: ["edit", "delete", "archive"],
    relatedSlugs: ["how-to-list-a-board", "i-sold-an-item-whats-next"],
    sections: [
      {
        heading: "Editing a listing",
        body: (
          <>
            <p>
              Open {helpLink("/dashboard/listings", "My Listings")}, find your board, and tap{" "}
              <strong>Edit</strong>. You can update photos, price, description, shipping options,
              and offer settings. Tap <strong>Save changes</strong> when you are done.
            </p>
            <p>
              You can also tap <strong>View</strong> to see the live listing as buyers see it.
            </p>
          </>
        ),
      },
      {
        heading: "Marking a board as sold",
        body: (
          <p>
            Sold the board elsewhere? From an active listing, choose <strong>Mark as Sold</strong>.
            That removes it from the marketplace and moves it to your Sold tab.
          </p>
        ),
      },
      {
        heading: "Ending or deleting a listing",
        body: (
          <>
            <p>
              Tap <strong>End listing</strong> on any active or draft listing. You can:
            </p>
            <BulletList
              items={[
                <><strong>Archive listing</strong> to take it off the public site. Archived listings stay in your account for 30 days.</>,
                <><strong>Delete listing</strong> to remove it immediately, when allowed. If the listing is tied to an order, archiving may be required instead.</>,
              ]}
            />
            <p>
              Find archived listings under {helpLink("/dashboard/listings/archived", "Archived")} in
              My Listings.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "verify-seller-information",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Setting up your payout destination",
    title: "How to verify your seller information",
    description:
      "Complete seller verification so you can receive payouts and cash out earnings from Reswell sales.",
    keywords: ["verify", "payout", "identity"],
    relatedSlugs: ["connect-payout-account", "how-long-to-get-paid", "where-payouts-available"],
    sections: [
      {
        heading: "Why verification matters",
        body: (
          <p>
            Before your first cash out, Reswell and our payment partners (Stripe) need to confirm
            who you are and where payouts should go. This is standard for marketplace sellers and
            helps keep the platform safe for everyone.
          </p>
        ),
      },
      {
        heading: "How to complete setup",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Open Earnings",
                body: (
                  <>
                    Go to {helpLink("/dashboard/earnings", "Earnings")} from your dashboard. If payout
                    details are missing, you will see <strong>Complete payout details</strong>.
                  </>
                ),
              },
              {
                title: "Follow the Stripe Connect flow",
                body: "Stripe may ask for your legal name, date of birth, address, and the last four digits of your SSN (for U.S. sellers). Have a government ID handy if requested.",
              },
              {
                title: "Connect your bank",
                body: (
                  <>
                    Add the bank account where you want payouts deposited. See{" "}
                    {helpLink("/help/selling/connect-payout-account", "How to connect a bank account for payouts")}.
                  </>
                ),
              },
            ]}
          />
        ),
      },
      {
        heading: "If something does not verify",
        body: (
          <>
            <p>
              Double check that your name matches your bank account and government ID. Typos are the
              most common cause of delays.
            </p>
            <p>
              Still stuck? {helpLink("/contact", "Contact support")} from the email on your Reswell
              account and we will help you finish setup.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "connect-payout-account",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Setting up your payout destination",
    title: "How to connect a bank account for payouts",
    description:
      "Link a U.S. bank account in Earnings to cash out your Reswell seller earnings via ACH transfer.",
    keywords: ["bank", "payout", "connect"],
    relatedSlugs: ["verify-seller-information", "how-long-to-get-paid", "where-payouts-available"],
    sections: [
      {
        heading: "Where to connect your bank",
        body: (
          <>
            <p>
              Open {helpLink("/dashboard/earnings", "Earnings")} and look for the{" "}
              <strong>Bank transfer (ACH)</strong> section. Tap{" "}
              <strong>Complete bank setup to cash out</strong> if you have not connected an account
              yet.
            </p>
            <p>
              Payouts are powered by Stripe Connect. Your bank details go directly to Stripe. Reswell
              does not store your full account number.
            </p>
          </>
        ),
      },
      {
        heading: "Managing payout banks",
        body: (
          <>
            <p>
              After setup, use <strong>Manage payout banks</strong> in Earnings to update or add
              accounts. Keep your details current so transfers are not delayed or returned.
            </p>
            <HelpNote>
              Payout availability depends on your country and Stripe support in your region. See{" "}
              {helpLink("/help/selling/where-payouts-available", "Where are Reswell payouts available?")}.
            </HelpNote>
          </>
        ),
      },
      {
        heading: "Before your first cash out",
        body: (
          <p>
            Verification must be complete and you need available (ready) balance in your wallet.
            Pending earnings from recent sales may still be held until carrier delivery is confirmed on
            Reswell tracking (plus a 24-hour review window) or pickup is verified. See{" "}
            {helpLink("/help/selling/how-long-to-get-paid", "How long does it take to get paid?")}.
          </p>
        ),
      },
    ],
  },
  {
    slug: "where-payouts-available",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Setting up your payout destination",
    title: "Where are Reswell payouts available?",
    description:
      "Which regions support Reswell seller payouts and what to do if bank setup is not available where you live.",
    keywords: ["payout", "region", "country"],
    relatedSlugs: ["connect-payout-account", "verify-seller-information"],
    sections: [
      {
        heading: "Current payout support",
        body: (
          <>
            <p>
              Reswell seller payouts run through Stripe Connect. Bank transfer (ACH) cash outs are
              built for U.S. bank accounts. Availability in other countries depends on Stripe&apos;s
              supported regions and your account verification status.
            </p>
            <p>
              You can still list and sell on Reswell in many cases, but cash out options may vary.
              Check Earnings after your first sale to see what is available for your account.
            </p>
          </>
        ),
      },
      {
        heading: "If setup is unavailable",
        body: (
          <>
            <p>
              When bank setup is not offered in your region yet, {helpLink("/contact", "contact support")}{" "}
              for the latest options. We can confirm whether payouts are supported for your country
              and what you need to do next.
            </p>
            <HelpNote>
              You can always spend ready wallet balance on other listings on Reswell while payout
              options are being set up, when your balance allows.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "i-sold-an-item-whats-next",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Receiving your earnings",
    title: "I sold a board. What should I do next?",
    description:
      "Your board sold on Reswell. Here is how to ship it, coordinate pickup, and get your earnings released.",
    keywords: ["sold", "ship", "next steps"],
    relatedSlugs: ["how-long-to-get-paid", "marketplace-fees", "respond-to-offers"],
    quickAnswer: (
      <>
        Open the sale in {helpLink("/dashboard/sales", "Sales")}. Ship with tracking or verify local
        pickup in Messages. Your earnings release to your wallet once the order clears Purchase
        Protection timelines.
      </>
    ),
    sections: [
      {
        heading: "Open your sale",
        body: (
          <>
            <p>
              Go to {helpLink("/dashboard/sales", "Sales")} and tap the order. You will see whether
              the buyer chose <strong>Ship to buyer</strong> or <strong>Local pickup</strong>, plus
              the buyer&apos;s contact info and any messages in the thread.
            </p>
            <p>
              Respond to buyer messages promptly. Good communication prevents most problems before
              they start.
            </p>
          </>
        ),
      },
      {
        heading: "If you are shipping",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Pack the board carefully",
                body: (
                  <>
                    Use a proper surfboard box and padding. Our{" "}
                    {helpLink("/shipping", "Shipping guide")} covers packing tips and box partners.
                  </>
                ),
              },
              {
                title: "Get a label and ship",
                body: (
                  <>
                    If Reswell prepared a label, tap <strong>Open label PDF</strong> or{" "}
                    <strong>Print label</strong> from the sale page. You can also purchase a label
                    via ShipEngine when available, or add your own tracking with{" "}
                    <strong>Add tracking</strong>.
                  </>
                ),
              },
              {
                title: "Ship the board",
                body: (
                  <>
                    For Reswell shipping, Reswell purchases the cheapest ShipEngine label after checkout and adds
                    tracking automatically. Print the label from your sale page, drop the package with the carrier,
                    then tap <strong>I&apos;ve dropped this off with the carrier</strong>. For your own label, enter
                    tracking with <strong>Save tracking</strong>. Ship within {SHIPPING_DEADLINE_DAYS} days of
                    purchase confirmation or the order may be auto canceled and refunded.
                  </>
                ),
              },
            ]}
          />
        ),
      },
      {
        heading: "If it is local pickup",
        body: (
          <>
            <p>
              Message the buyer to agree on a safe, public meeting place and time. The buyer has a
              pickup code on their purchase page. When they are satisfied with the board, they share
              the code and you tap <strong>Verify pickup</strong> on the sale page to enter the
              6 digit code. That releases your payout.
            </p>
            <HelpNote>
              Read our {helpLink("/safety", "Safety tips")} before meeting a buyer in person.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "how-long-to-get-paid",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Receiving your earnings",
    title: "How long does it take to get paid?",
    description:
      "When your Reswell sale earnings move from pending to ready, and how long bank cash outs take.",
    keywords: ["paid", "payout", "timing"],
    relatedSlugs: ["i-sold-an-item-whats-next", "marketplace-fees", "how-cash-outs-work"],
    sections: [
      {
        heading: "Pending vs. ready balance",
        body: (
          <>
            <p>
              After a sale, your earnings show as <strong>Pending</strong> in{" "}
              {helpLink("/dashboard/earnings", "Earnings")} until the order clears Purchase Protection
              timelines. That usually means the buyer received the board (tracked shipping) or you
              verified pickup.
            </p>
            <p>
              Once released, funds move to your <strong>Ready to transfer to your bank</strong>{" "}
              balance. You can spend ready balance on other listings or cash out to your bank.
            </p>
          </>
        ),
      },
      {
        heading: "What can hold up a payout",
        body: (
          <BulletList
            items={[
              <>Shipped orders: tracking not added yet, or carrier has not reported delivery (Reswell releases earnings 24 hours after carrier delivery).</>,
              <>Pickup orders: pickup code not verified.</>,
              <>An open Purchase Protection claim or refund on the order.</>,
            ]}
          />
        ),
      },
      {
        heading: "Cashing out to your bank",
        body: (
          <>
            <p>
              When funds are ready, tap <strong>Cash out</strong> in Earnings. Standard ACH transfers
              typically arrive in 2 to 3 business days. Instant transfer may be available for a fee,
              depending on your bank and Stripe support.
            </p>
            <p>
              Full details on cash outs live in{" "}
              {helpLink("/help/accounts/how-cash-outs-work", "How do cash outs work?")}.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "marketplace-fees",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Receiving your earnings",
    title: "What are Reswell's selling fees?",
    description:
      "Reswell charges a 7% marketplace fee on the item price. Here is exactly what you keep and what Reswell covers.",
    keywords: ["fees", "commission"],
    relatedSlugs: ["how-long-to-get-paid", "how-to-list-a-board", "seller-returns"],
    sections: [
      {
        heading: "The marketplace fee",
        body: (
          <>
            <p>
              On completed sales, Reswell takes a <strong>{MARKETPLACE_FEE_PERCENT}%</strong>{" "}
              marketplace fee on the <strong>item price only</strong>. You keep{" "}
              <strong>{SELLER_SHARE_PERCENT}%</strong> of the listing price.
            </p>
            <p>
              Your sale page breaks this down: <strong>Item price</strong>,{" "}
              <strong>Platform fee ({MARKETPLACE_FEE_PERCENT}% of item)</strong>, and{" "}
              <strong>Your earnings</strong>.
            </p>
          </>
        ),
      },
      {
        heading: "What is not deducted from you",
        body: (
          <BulletList
            items={[
              <>Shipping paid by the buyer goes to the carrier, not to you, and is not part of your earnings or the fee calculation.</>,
              <>Card processing (Stripe) is absorbed by Reswell. It is not taken out of your payout on top of the {MARKETPLACE_FEE_PERCENT}% fee.</>,
              <>Purchase Protection for buyers is funded from the marketplace fee. There is no separate protection charge to sellers.</>,
            ]}
          />
        ),
      },
      {
        heading: "Listing is free",
        body: (
          <>
            <p>
              Creating and maintaining listings costs nothing. You only pay the marketplace fee when
              a sale actually completes through Reswell checkout.
            </p>
            <p>
              Full terms are in our {helpLink("/terms", "Terms of Service")} and{" "}
              {helpLink("/protection-policy", "Purchase Protection")} page.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "respond-to-offers",
    topicId: "selling",
    sectionSlug: "managing-orders",
    sectionTitle: "Managing orders",
    groupTitle: "Offers and messages",
    title: "How do I respond to messages and offers?",
    description:
      "Accept, counter, or decline buyer offers on Reswell from Messages or your Offers dashboard.",
    keywords: ["offers", "messages", "counter"],
    relatedSlugs: ["how-to-list-a-board", "i-sold-an-item-whats-next", "leave-feedback-buyer"],
    quickAnswer: (
      <>
        Buyer messages and offers show up in {helpLink("/messages", "Messages")} and on{" "}
        {helpLink("/dashboard/offers", "Offers")} under <strong>On my listings</strong>. Tap{" "}
        <strong>Respond to offer</strong> to accept, counter, or decline.
      </>
    ),
    sections: [
      {
        heading: "Where offers appear",
        body: (
          <>
            <p>
              When a buyer makes an offer on your listing, you will see it in {helpLink("/messages", "Messages")}{" "}
              and on {helpLink("/dashboard/offers", "Offers")} under the <strong>On my listings</strong>{" "}
              tab. Each tile shows the offer amount, status, and expiry time.
            </p>
            <p>
              General buyer questions (not tied to an offer) also land in Messages. Reply there to
              keep everything on record.
            </p>
          </>
        ),
      },
      {
        heading: "Responding to an offer",
        body: (
          <>
            <p>
              Tap <strong>Respond to offer</strong> or <strong>Review &amp; respond</strong> to open
              the offer details dialog. You can:
            </p>
            <BulletList
              items={[
                <><strong>Accept</strong> the buyer&apos;s price. They can then check out at that amount.</>,
                <><strong>Counter</strong> with a different price (up to three counters per thread). Add an optional note.</>,
                <><strong>Decline</strong> if the offer does not work for you.</>,
              ]}
            />
            <p>
              Offers expire <strong>48 hours</strong> after submission. Respond before the deadline
              shown as <strong>Expires …</strong> on the offer tile.
            </p>
          </>
        ),
      },
      {
        heading: "Tips for sellers",
        body: (
          <>
            <BulletList
              items={[
                <>Respond quickly. Active buyers often have other boards in mind.</>,
                <>Use Messages to clarify shipping or pickup before accepting a low offer.</>,
                <>You can send a seller initiated offer from a message thread when negotiation makes sense.</>,
                <>Your minimum offer threshold is set when you create the listing (typically around 70% of list price).</>,
              ]}
            />
          </>
        ),
      },
    ],
  },
  {
    slug: "seller-returns",
    topicId: "selling",
    sectionSlug: "managing-orders",
    sectionTitle: "Managing orders",
    groupTitle: "Returns and refunds",
    title: "How do returns work for sellers on Reswell?",
    description:
      "What happens when a buyer opens a return or Purchase Protection claim on your sale, and how to cooperate through the process.",
    keywords: ["return", "refund", "seller"],
    relatedSlugs: ["cancel-order-seller", "marketplace-fees", "i-sold-an-item-whats-next"],
    sections: [
      {
        heading: "When a buyer opens a claim",
        body: (
          <>
            <p>
              Buyers can request help through <strong>Refund help</strong> on their purchase page for
              covered problems: item not received, not as described, or transit damage. Reswell
              typically reviews claims within <strong>3 business days</strong>.
            </p>
            <p>
              You will be notified and may need to cooperate in Messages or confirm receipt of a
              returned board. Stay responsive. Delays can extend the resolution.
            </p>
          </>
        ),
      },
      {
        heading: "How refunds affect sellers",
        body: (
          <>
            <p>
              Approved refunds come from the purchase amount, including Reswell&apos;s marketplace
              fee. Sellers are not charged an extra protection fee on top of the original sale.
            </p>
            <p>
              For not as described or damage claims on shipped orders, Reswell may provide a prepaid
              return label. Your refund obligation completes when you confirm receipt of the return,
              per {helpLink("/protection-policy", "Purchase Protection")}.
            </p>
          </>
        ),
      },
      {
        heading: "Return policy basics",
        body: (
          <>
            <p>
              U.S. buyers may also qualify for returns under our {helpLink("/return-policy", "Return Policy")}{" "}
              within <strong>7 calendar days of delivery</strong> for eligible purchases. There are
              no exchanges and no restocking fee.
            </p>
            <HelpNote>
              Local pickup sales are not covered by Purchase Protection claims. Keep your listings
              accurate and your photos honest to avoid most disputes.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "cancel-order-seller",
    topicId: "selling",
    sectionSlug: "managing-orders",
    sectionTitle: "Managing orders",
    groupTitle: "Returns and refunds",
    title: "How do I cancel an order?",
    description:
      "What to do when you cannot fulfill a Reswell sale and need to cancel or request a refund through support.",
    keywords: ["cancel", "order"],
    relatedSlugs: ["seller-returns", "i-sold-an-item-whats-next", "respond-to-offers"],
    sections: [
      {
        heading: "When you need to cancel",
        body: (
          <p>
            Sometimes a sale cannot go through: the board got damaged, you sold it elsewhere before
            shipping, or you cannot coordinate pickup. Do not ship an order you intend to cancel.
            Contact the buyer and Reswell support as soon as you know.
          </p>
        ),
      },
      {
        heading: "How to request a cancellation",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Message the buyer",
                body: "Explain what happened in the purchase thread. Transparency goes a long way.",
              },
              {
                title: "Open the sale page",
                body: (
                  <>
                    Go to {helpLink("/dashboard/sales", "Sales")}, open the order, and look for{" "}
                    <strong>Ask Reswell for a refund or cancellation</strong>.
                  </>
                ),
              },
              {
                title: "Submit a support request",
                body: (
                  <>
                    Choose <strong>Ask Reswell to cancel the order</strong> or{" "}
                    <strong>Ask Reswell to issue a refund</strong>. Include a clear explanation (at
                    least 10 characters). Our team will guide next steps.
                  </>
                ),
              },
            ]}
          />
        ),
      },
      {
        heading: "Auto cancellation for late shipping",
        body: (
          <p>
            If you do not ship within {SHIPPING_DEADLINE_DAYS} days of purchase confirmation, Reswell
            automatically cancels the order and refunds the buyer. You do not need to request that
            yourself, but repeated late shipments can affect your seller reputation.
          </p>
        ),
      },
    ],
  },
  {
    slug: "leave-feedback-buyer",
    topicId: "selling",
    sectionSlug: "managing-orders",
    sectionTitle: "Managing orders",
    groupTitle: "Contacting your buyer",
    title: "How do I leave feedback for a buyer?",
    description:
      "Review a buyer after a completed sale and ask them to leave feedback for you.",
    keywords: ["feedback", "review", "buyer"],
    relatedSlugs: ["i-sold-an-item-whats-next", "respond-to-offers"],
    sections: [
      {
        heading: "Leaving a buyer review",
        body: (
          <>
            <p>
              After a sale completes, open the order in {helpLink("/dashboard/sales", "Sales")}. On
              the buyer card, tap <strong>Review buyer</strong> to leave a star rating and comment.
            </p>
            <p>
              Honest feedback helps other sellers know what to expect. Keep it factual and
              constructive.
            </p>
          </>
        ),
      },
      {
        heading: "Asking the buyer for a review",
        body: (
          <p>
            Once delivery or pickup is complete, you can tap <strong>Ask buyer for review</strong> on
            the sale page. That sends a prompt in your Messages thread so the buyer can review you
            too.
          </p>
        ),
      },
      {
        heading: "Why reviews matter",
        body: (
          <>
            <p>
              Good reviews build trust for future listings. Buyers often check seller history before
              they buy or make an offer.
            </p>
            <HelpNote>
              When a buyer leaves you a positive review, their Purchase Protection window on that
              order can close early. That is normal and means the transaction went smoothly.
            </HelpNote>
          </>
        ),
      },
    ],
  },
]
