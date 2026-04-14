import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare, HelpCircle } from "lucide-react"
import { ContactForm } from "./contact-form"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Contact — Reswell",
  description: "Reach the Reswell team for support, feedback, partnership, or account questions.",
  path: "/contact",
})

export default function ContactPage() {
  return (
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-center gap-3 mb-8">
            <MessageSquare className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Contact Us</h1>
              <p className="text-muted-foreground mt-1">
                We’d love to hear from you
              </p>
            </div>
          </div>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            For questions about your account, a transaction, or the marketplace, use the form below. For quick answers, check our{" "}
            <a href="/help" className="text-primary underline">Help Center</a>,{" "}
            <a href="/safety" className="text-primary underline">Safety Tips</a>, and{" "}
            <a href="/shipping" className="text-primary underline">Shipping Guide</a>.
          </p>

          <ContactForm />

          <Card className="mt-10 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Response time</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We aim to respond within 1–2 business days. For urgent safety or fraud issues, note “Urgent” in your message.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
  )
}
