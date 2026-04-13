"use client"

import { ChevronUp } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "When will I get my items?",
    a: "After you pay the seller, you coordinate delivery or pickup in messages. Timing depends on the listing’s fulfillment options and the seller’s availability.",
  },
  {
    q: "Can I pick up my items in person?",
    a: "Yes, when the seller offers local pickup. If both pickup and shipping are available, you can choose at checkout. Otherwise follow the seller’s pickup instructions.",
  },
  {
    q: "What are my payment options?",
    a: "Peer surfboard purchases use secure card checkout (Stripe) when the seller has payments enabled. You’ll complete payment on the checkout screen.",
  },
  {
    q: "What are my financing options?",
    a: "Reswell does not offer financing today. You pay the listing total (and shipping when applicable) at checkout with your card.",
  },
  {
    q: "When I buy on Reswell, is my order ready to ride?",
    a: "Listings describe condition and what’s included. Confirm details with the seller before you pay. Use messages to ask about fins, dings, or pickup logistics.",
  },
]

export function CartBuyingFaq({ className }: { className?: string }) {
  return (
    <Collapsible defaultOpen className={cn("group w-full", className)}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 py-2 text-left">
        <h2 className="text-[21px] font-semibold tracking-tight text-black dark:text-foreground">
          Questions About Buying
        </h2>
        <ChevronUp
          className="h-5 w-5 shrink-0 text-neutral-500 transition-transform duration-200 group-data-[state=closed]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Accordion type="single" collapsible className="mt-4 w-full border-t border-neutral-200 pt-2 dark:border-white/10">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={item.q}
              value={`q-${i}`}
              className="border-neutral-200 dark:border-white/10"
            >
              <AccordionTrigger className="py-5 text-left text-[17px] font-normal text-neutral-900 hover:no-underline dark:text-foreground [&>svg]:text-neutral-400">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-neutral-600 dark:text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CollapsibleContent>
    </Collapsible>
  )
}
