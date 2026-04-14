import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpCircle } from "lucide-react"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Help Center — Reswell",
  description: "Get answers about buying and selling surfboards, Reswell Bucks, shipping, and messaging.",
  path: "/help",
})

const faqs = [
  {
    question: "How do I buy an item?",
    answer: "Browse surfboards, open a listing you like, and use \"Contact Seller\" or \"Buy with Reswell Bucks.\" If the seller ships, you can pay with Reswell Bucks (in-app currency) or coordinate payment and shipping in Messages.",
  },
  {
    question: "How do I sell an item?",
    answer: "Sign in, click \"Sell\" in the header, and create a surfboard listing. Add photos, dimensions, price, and condition. You can offer local pickup, shipping, or both so buyers can inspect or receive the board.",
  },
  {
    question: "What are Reswell Bucks?",
    answer: "Reswell Bucks are our in-app currency. Buyers use them to purchase items from sellers; sellers receive Bucks in their wallet and can cash out to PayPal, Venmo, or bank transfer. This keeps transactions secure and simple within the community.",
  },
  {
    question: "How do I contact a seller or buyer?",
    answer: "Use the Messages section (envelope icon in the header) to start or continue a conversation. Messages are tied to a specific listing so you can discuss condition, shipping, or pickup details in one place.",
  },
  {
    question: "What if I have a problem with a purchase?",
    answer: "Try to resolve the issue directly with the seller via messages first. If you used Reswell Bucks, our team can help with eligible disputes. For serious issues (e.g. fraud or safety), reach out via our Contact page and we’ll review.",
  },
]

export default function HelpCenterPage() {
  return (
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <HelpCircle className="h-10 w-10 text-black dark:text-white" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Help Center</h1>
              <p className="text-muted-foreground mt-1">
                Answers to common questions about buying and selling on Reswell
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-10 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <p className="font-medium text-foreground">Still need help?</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Check our <Link href="/safety" className="text-primary underline">Safety Tips</Link> and{" "}
                <Link href="/shipping" className="text-primary underline">Shipping Guide</Link>, or{" "}
                <Link href="/contact" className="text-primary underline">Contact Us</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
  )
}
