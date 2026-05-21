import type { HelpArticle } from "@/lib/help-center/types"
import {
  BulletList,
  HelpNote,
  NumberedSteps,
  helpFigure,
  helpLink,
} from "@/lib/help-center/content-helpers"

export const accountsHelpArticles: HelpArticle[] = [
  {
    slug: "update-profile-settings",
    topicId: "accounts",
    sectionSlug: "profile-and-settings",
    sectionTitle: "Profile and settings",
    groupTitle: "Your account",
    title: "How do I change my profile, password, or notifications?",
    description:
      "Update your display name, photo, bio, saved addresses, and password from your Reswell profile settings.",
    keywords: ["profile", "password", "settings"],
    relatedSlugs: ["account-access-deletion", "where-are-messages"],
    sections: [
      {
        heading: "Profile information",
        body: (
          <>
            <p>
              Go to {helpLink("/dashboard/profile", "Profile")} from your dashboard. Under{" "}
              <strong>Profile Information</strong> you can update:
            </p>
            <BulletList
              items={[
                <><strong>Profile Photo</strong> with <strong>Change photo</strong> or <strong>Remove photo</strong></>,
                <><strong>Display Name</strong>, <strong>Location</strong>, <strong>City</strong>, and <strong>Bio</strong></>,
              ]}
            />
            <p>
              Your email address is shown but cannot be changed from this page. Tap{" "}
              <strong>Save Changes</strong> when you are done.
            </p>
          </>
        ),
      },
      {
        heading: "Password and sign in",
        body: (
          <>
            <p>
              Scroll to the <strong>Account</strong> section on the same page:
            </p>
            <BulletList
              items={[
                <>
                  <strong>Email reset link</strong> sends a password reset email if you sign in with
                  email and password, or if you use Google/OAuth and need to set a password.
                </>,
                <>
                  <strong>Change password</strong> (email accounts): enter your current password,
                  new password, and confirmation, then tap <strong>Save new password</strong>.
                  Passwords must be at least 6 characters.
                </>,
                <><strong>Sign Out</strong> to log out of your current session.</>,
              ]}
            />
            <p>
              Forgot your password on the sign in page? Tap <strong>Forgot password?</strong> and
              use <strong>Send reset link</strong>.
            </p>
          </>
        ),
      },
      {
        heading: "Saved addresses",
        body: (
          <>
            <p>
              Open the <strong>Addresses</strong> tab on your profile page (or go to{" "}
              {helpLink("/dashboard/profile#addresses", "Profile, Addresses tab")}). Add and manage
              shipping addresses you use at checkout.
            </p>
            <HelpNote>
              Reswell does not currently offer granular notification toggles in profile settings.
              Important order and offer updates still reach you by email and in your dashboard.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "account-access-deletion",
    topicId: "accounts",
    sectionSlug: "profile-and-settings",
    sectionTitle: "Profile and settings",
    groupTitle: "Your account",
    title: "Help with account access or deletion",
    description:
      "Locked out of your Reswell account or want it deleted? Here is how to get help and what to expect.",
    keywords: ["delete", "access", "login"],
    relatedSlugs: ["update-profile-settings", "avoid-scams"],
    sections: [
      {
        heading: "If you cannot sign in",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Try password reset",
                body: (
                  <>
                    On the sign in page, tap <strong>Forgot password?</strong> and enter the email
                    on your account. Check spam if the reset link does not arrive within a few
                    minutes.
                  </>
                ),
              },
              {
                title: "Try the same sign in method you used before",
                body: "If you originally signed up with Google, use Continue with Google. Mixing methods can make it look like the account does not exist.",
              },
              {
                title: "Contact support",
                body: (
                  <>
                    Still locked out? {helpLink("/contact", "Contact us")} from the email you believe
                    is on the account. We verify ownership before making changes.
                  </>
                ),
              },
            ]}
          />
        ),
        figure: helpFigure(
          "sign-in.png",
          "Reswell sign in page with email and Google options",
          "Use Forgot password? on the sign in page if you need to reset your credentials.",
        ),
      },
      {
        heading: "Requesting account deletion",
        body: (
          <>
            <p>
              To delete your Reswell account, {helpLink("/contact", "contact support")} from the
              email address registered on the account. Tell us you want the account deleted and
              include any relevant details (active listings, open orders, wallet balance).
            </p>
            <p>
              We verify ownership before processing deletion. Open orders or pending payouts may need
              to resolve first.
            </p>
          </>
        ),
      },
      {
        heading: "Before you delete",
        body: (
          <BulletList
            items={[
              <>End or complete any active listings and sales.</>,
              <>Cash out remaining wallet balance from {helpLink("/dashboard/earnings", "Earnings")} if applicable.</>,
              <>Download any records you need. Deleted accounts cannot be recovered.</>,
            ]}
          />
        ),
      },
    ],
  },
  {
    slug: "wallet-and-earnings-overview",
    topicId: "accounts",
    sectionSlug: "wallet-and-earnings",
    sectionTitle: "Wallet and earnings",
    groupTitle: "Wallet",
    title: "What is my wallet balance?",
    description:
      "Your Reswell wallet holds earnings from sales. Here is how pending and ready balance works.",
    keywords: ["wallet", "balance", "earnings"],
    relatedSlugs: ["how-cash-outs-work", "update-profile-settings"],
    sections: [
      {
        heading: "What the wallet is",
        body: (
          <>
            <p>
              Your wallet is where money from completed Reswell sales lands. Open{" "}
              {helpLink("/dashboard/earnings", "Earnings")} to see your balance, recent activity,
              and cash out options.
            </p>
            <p>
              You can spend ready balance on other listings at checkout or transfer it to your bank.
            </p>
          </>
        ),
      },
      {
        heading: "Pending vs. ready",
        body: (
          <>
            <p>Earnings shows a few numbers that matter:</p>
            <BulletList
              items={[
                <><strong>Pending</strong> holds earnings from recent sales until delivery or pickup is confirmed and any hold clears.</>,
                <><strong>Ready to transfer to your bank</strong> is spendable now. Cash out or use it at checkout.</>,
                <><strong>Total (including pending)</strong> is everything in your wallet.</>,
              ]}
            />
            <p>
              Sellers: see{" "}
              {helpLink("/help/selling/how-long-to-get-paid", "How long does it take to get paid?")}{" "}
              for release timelines.
            </p>
          </>
        ),
      },
      {
        heading: "Activity history",
        body: (
          <>
            <p>
              Filter your ledger by <strong>All</strong>, <strong>Ready</strong>,{" "}
              <strong>Pending</strong>, <strong>Refunds</strong>, or <strong>Payouts</strong> to
              trace individual sales, fee deductions, and bank transfers.
            </p>
            <HelpNote>
              Refunds on orders you bought with wallet balance return to your wallet. Card refunds
              go back to your card.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "how-cash-outs-work",
    topicId: "accounts",
    sectionSlug: "wallet-and-earnings",
    sectionTitle: "Wallet and earnings",
    groupTitle: "Cash outs",
    title: "How do cash outs work?",
    description:
      "Transfer ready earnings from your Reswell wallet to your bank account via ACH or instant transfer.",
    keywords: ["cash out", "withdraw", "payout"],
    relatedSlugs: ["wallet-and-earnings-overview", "update-profile-settings"],
    sections: [
      {
        heading: "Before you cash out",
        body: (
          <>
            <p>
              You need <strong>ready</strong> balance (not pending) and a connected bank account.
              Complete payout setup in {helpLink("/dashboard/earnings", "Earnings")} if you have not
              already. See{" "}
              {helpLink("/help/selling/connect-payout-account", "How to connect a bank account for payouts")}.
            </p>
          </>
        ),
      },
      {
        heading: "Starting a cash out",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Open Earnings",
                body: (
                  <>
                    Go to {helpLink("/dashboard/earnings", "Earnings")}. Your ready balance appears
                    under <strong>Balance</strong>.
                  </>
                ),
              },
              {
                title: "Tap Cash out",
                body: (
                  <>
                    Tap <strong>Cash out</strong> (shown with your available amount) in the Bank
                    transfer section.
                  </>
                ),
              },
              {
                title: "Choose transfer speed",
                body: (
                  <>
                    Pick <strong>Standard (free)</strong>, usually 2 to 3 business days, or{" "}
                    <strong>Instant</strong> when available (a fee applies). Confirm the transfer.
                  </>
                ),
              },
            ]}
          />
        ),
      },
      {
        heading: "Tracking your transfer",
        body: (
          <>
            <p>
              Bank transfers appear in <strong>Bank transfer history</strong> with statuses like{" "}
              <strong>Processing</strong>, <strong>Sent</strong>, or <strong>Reversed</strong>. Use{" "}
              <strong>Manage payout banks</strong> to update your account if a transfer fails.
            </p>
            <HelpNote>
              Keep payout details up to date. Returned transfers usually mean a closed account or
              mismatched name.
            </HelpNote>
          </>
        ),
      },
    ],
  },
  {
    slug: "where-are-messages",
    topicId: "accounts",
    sectionSlug: "messages-and-security",
    sectionTitle: "Messages and security",
    groupTitle: "Messages",
    title: "Where do I find my messages?",
    description:
      "Open your Reswell Messages inbox for buyer and seller conversations, offers, and order threads.",
    keywords: ["messages", "inbox"],
    relatedSlugs: ["avoid-scams", "update-profile-settings"],
    sections: [
      {
        heading: "Opening Messages",
        body: (
          <>
            <p>
              Tap <strong>Messages</strong> in the site header or go to {helpLink("/messages", "Messages")}.
              All your conversations live here, tied to listings and purchases so context stays in
              one thread.
            </p>
            <p>
              Tap any thread to open {helpLink("/messages", "the conversation")}. Offer cards,
              pickup coordination, and order updates all appear in the same place.
            </p>
          </>
        ),
      },
      {
        heading: "Chats vs. Activity",
        body: (
          <>
            <p>Messages has two tabs:</p>
            <BulletList
              items={[
                <><strong>Chats</strong> for direct conversations with buyers and sellers.</>,
                <><strong>Activity</strong> for favorites, follows, and offer related notifications.</>,
              ]}
            />
            <p>
              Sellers manage incoming offers from Messages or the dedicated{" "}
              {helpLink("/dashboard/offers", "Offers")} page.
            </p>
          </>
        ),
      },
      {
        heading: "Getting help from Messages",
        body: (
          <p>
            Tap <strong>Need help?</strong> in Messages to open support topics like{" "}
            <strong>General help</strong>, <strong>My account</strong>,{" "}
            <strong>Buying or selling</strong>, <strong>Payments &amp; payouts</strong>, or{" "}
            <strong>Safety or another member</strong>.
          </p>
        ),
      },
    ],
  },
  {
    slug: "avoid-scams",
    topicId: "accounts",
    sectionSlug: "messages-and-security",
    sectionTitle: "Messages and security",
    groupTitle: "Staying safe",
    title: "What should I do if I think I am being scammed?",
    description:
      "Red flags to watch for on Reswell and how to report suspicious listings, messages, or payment requests.",
    keywords: ["scam", "fraud", "safety"],
    relatedSlugs: ["where-are-messages", "account-access-deletion", "update-profile-settings"],
    sections: [
      {
        heading: "Common red flags",
        body: (
          <>
            <p>Trust your gut. Be cautious if someone:</p>
            <BulletList
              items={[
                <>Asks you to pay outside Reswell (Venmo, PayPal, wire, cash app).</>,
                <>Pushes you to move the conversation off platform to text or email only.</>,
                <>Offers a price that seems too good to be true with pressure to act fast.</>,
                <>Refuses to meet in a public place for local pickup.</>,
                <>Asks for personal financial info, login codes, or gift cards.</>,
              ]}
            />
            <p>
              Read the full list on our {helpLink("/safety", "Safety tips")} page.
            </p>
          </>
        ),
      },
      {
        heading: "What to do",
        body: (
          <NumberedSteps
            steps={[
              {
                title: "Do not pay or share sensitive info",
                body: "Stop the conversation if someone pushes an off platform payment. Legitimate Reswell sales always go through checkout.",
              },
              {
                title: "Report the listing or user",
                body: (
                  <>
                    On a listing page, use <strong>Report listing to Reswell</strong>. In Messages,
                    tap <strong>Need help?</strong> and choose <strong>Safety or another member</strong>.
                  </>
                ),
              },
              {
                title: "Contact support",
                body: (
                  <>
                    {helpLink("/contact", "Contact us")} with screenshots and the listing or order
                    link. We take reports seriously and will investigate.
                  </>
                ),
              },
            ]}
          />
        ),
      },
      {
        heading: "Stay protected",
        body: (
          <>
            <p>
              Paying through Reswell checkout keeps Purchase Protection in play for eligible
              purchases. Off platform payments are not covered, and we cannot help recover money
              sent elsewhere.
            </p>
            <HelpNote>
              Keep all purchase related messages on Reswell. Our team can only review on platform
              threads when investigating a dispute.
            </HelpNote>
          </>
        ),
      },
    ],
  },
]
