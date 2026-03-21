import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpCircle } from "lucide-react"

export const metadata = {
  title: "Help Center - Reswell",
  description: "Get answers to common questions about buying and selling surf gear on Reswell.",
}

const faqs = [
  {
    question: "How do I buy an item?",
    answer: "Browse used gear or surfboards, click on a listing you like, and use the \"Contact Seller\" or \"Buy with Reswell Bucks\" option. For items that ship, you can pay with Reswell Bucks (in-app currency) or coordinate payment and shipping directly with the seller via messages.",
  },
  {
    question: "How do I sell an item?",
    answer: "Sign in, click \"Sell\" in the header, and create a listing. Add photos, a title, description, price, and condition. For used gear you can offer shipping; for surfboards we recommend in-person pickup only so buyers can inspect the board.",
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
    answer: "Try to resolve the issue directly with the seller via messages first. If you used Reswell Bucks, our team can help with eligible disputes. For serious issues (e.g. fraud or safety), use the report options on the listing or in Messages and we’ll review.",
  },
]

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <HelpCircle className="h-10 w-10 text-primary" />
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
      <Footer />
    </div>
  )
}
