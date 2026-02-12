import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, MessageSquare, Eye, MapPin, AlertTriangle } from "lucide-react"

export const metadata = {
  title: "Safety Tips - ReSwell Surf",
  description: "Stay safe when buying and selling surf gear. Best practices for meeting sellers, payments, and avoiding scams.",
}

const tips = [
  {
    icon: MessageSquare,
    title: "Communicate on the platform",
    body: "Keep conversations in ReSwell Surf messages so we have a record. Avoid moving to external email or text for payment or pickup details until you’re comfortable.",
  },
  {
    icon: MapPin,
    title: "Meet in safe, public places",
    body: "For local pickup, choose a well-lit, public location (e.g. coffee shop, parking lot). Avoid inviting strangers to your home or going to theirs for the first meetup.",
  },
  {
    icon: Eye,
    title: "Inspect before you pay",
    body: "For surfboards and high-value gear, inspect the item in person before paying. Check for dings, delamination, or wear that wasn’t clear in the listing.",
  },
  {
    icon: Shield,
    title: "Prefer ReSwell Bucks when possible",
    body: "Paying with ReSwell Bucks keeps the transaction on the platform and makes it easier for us to help if something goes wrong. Be cautious with off-platform payment requests.",
  },
  {
    icon: AlertTriangle,
    title: "Watch for red flags",
    body: "Be wary of deals that seem too good to be true, sellers who pressure you to pay outside the app, or anyone who refuses to meet in person for local pickup when that was agreed.",
  },
]

export default function SafetyTipsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Safety Tips</h1>
              <p className="text-muted-foreground mt-1">
                Best practices for buying and selling safely on ReSwell Surf
              </p>
            </div>
          </div>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            ReSwell Surf is built on trust. Following these tips helps keep you and the community safe when meeting up, shipping, or paying for gear.
          </p>

          <div className="space-y-6">
            {tips.map((tip, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <tip.icon className="h-5 w-5 text-primary" />
                    {tip.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{tip.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            If you see something that violates our guidelines or seems like a scam, report it from the listing or in Messages. See our{" "}
            <Link href="/terms" className="text-primary underline">Terms of Service</Link> for more.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
