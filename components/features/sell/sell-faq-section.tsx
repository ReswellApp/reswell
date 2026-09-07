import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { helpArticlePath } from "@/lib/help-center/paths"

const SELL_FAQS = [
  {
    question: "How do I list something for sale?",
    answer:
      "Search our catalog by brand or model to jumpstart your listing, or list by type. Add photos, price, condition, and pickup or shipping. Posting is free.",
    href: helpArticlePath("selling", "how-to-list-a-board"),
  },
  {
    question: "What are Reswell’s selling fees?",
    answer:
      "It’s free to list. Fees apply when you make a sale — details are in our marketplace fees guide.",
    href: helpArticlePath("selling", "marketplace-fees"),
  },
  {
    question: "How long does it take to get paid?",
    answer:
      "Earnings go to your wallet after the sale reaches the right state. Connect a bank account to cash out when you’re ready.",
    href: helpArticlePath("selling", "how-long-to-get-paid"),
  },
  {
    question: "How do I respond to messages and offers?",
    answer:
      "Buyer chats land in Messages. Offers show in the thread and in your dashboard so you can accept, counter, or decline.",
    href: helpArticlePath("selling", "respond-to-offers"),
  },
  {
    question: "I made a sale. What should I do next?",
    answer:
      "Open the sale from Sales. Ship with tracking or confirm local pickup in Messages. Add tracking on the sale page when you ship.",
    href: helpArticlePath("selling", "i-sold-an-item-whats-next"),
  },
  {
    question: "How do returns work for sellers?",
    answer:
      "Eligible checkout purchases may be covered by Purchase Protection. See the seller returns guide for timelines and next steps.",
    href: helpArticlePath("selling", "seller-returns"),
  },
  {
    question: "How do I connect a bank account for payouts?",
    answer:
      "Verify your seller info, then connect payouts from your dashboard so you can cash out earnings to your bank.",
    href: helpArticlePath("selling", "connect-payout-account"),
  },
  {
    question: "How do I verify my seller information?",
    answer:
      "Complete seller verification so buyers can trust your shop and you can receive payouts without friction.",
    href: helpArticlePath("selling", "verify-seller-information"),
  },
] as const

/** Help-center FAQ strip for the sell hub — Reverb-like contrast, Reswell style. */
export function SellFaqSection() {
  return (
    <section className="border-t border-border/60 bg-[#E8EEF8] px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="font-headline text-2xl font-bold tracking-tight text-[#001A4A] sm:text-3xl">
            More about selling on Reswell
          </h2>
          <p className="mt-2 text-sm text-[#5c6b89] sm:text-base">
            Common questions from the{" "}
            <Link
              href="/help/selling"
              className="font-medium text-[#001A4A] underline underline-offset-4"
            >
              Help Center
            </Link>
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-10 flex flex-col gap-3">
          {SELL_FAQS.map((faq) => (
            <AccordionItem
              key={faq.question}
              value={faq.question}
              className="rounded-xl border-0 bg-white px-5 shadow-none"
            >
              <AccordionTrigger className="py-4 text-left text-[15px] font-medium text-[#001A4A] hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-[#5c6b89]">
                <p>{faq.answer}</p>
                <Link
                  href={faq.href}
                  className="mt-3 inline-block font-medium text-[#001A4A] underline underline-offset-4"
                >
                  Read more
                </Link>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
