"use client"

import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { FOR_SURF_SHOPS_FAQS } from "@/lib/for-surf-shops"

export function ForSurfShopsFaq() {
  return (
    <Accordion type="single" collapsible className="mx-auto flex max-w-3xl flex-col gap-3">
      {FOR_SURF_SHOPS_FAQS.map((faq) => (
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
  )
}
