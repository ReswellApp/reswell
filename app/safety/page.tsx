import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield } from "lucide-react"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Safety tips — Reswell",
  description:
    "Tips for buying and selling surf gear safely on Reswell, covering meetups, on platform payments, and spotting scams.",
  path: "/safety",
})

const tips = [
  {
    title: "Keep the conversation on Reswell",
    body: "Do your talking inside Reswell messages so we have a record of what was agreed. Try not to move to email or text for payment or pickup details until you know who you're dealing with.",
  },
  {
    title: "Meet somewhere public and well lit",
    body: "For local pickup, pick a busy, well lit spot like a coffee shop or a store parking lot. It's a good idea not to invite a stranger to your home, or go to theirs, on a first meetup.",
  },
  {
    title: "Inspect the board before you pay",
    body: "For surfboards and anything pricey, take a proper look in person before you hand over any money. Check for dings, delamination, or wear that wasn't obvious in the listing photos.",
  },
  {
    title: "Pay through Reswell",
    body: "Paying through Reswell checkout (including with your wallet balance) keeps the sale on the platform and makes it easier for us to help if something goes sideways. Be careful with anyone who pushes you to pay outside the app.",
  },
  {
    title: "Trust your gut on red flags",
    body: "Be wary of deals that look too good to be true, sellers who pressure you to pay outside the app, or anyone who won't meet in person for a local pickup you already agreed on.",
  },
]

export default function SafetyTipsPage() {
  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Safety Tips</h1>
            <p className="text-muted-foreground mt-1">
              How to buy and sell on Reswell without getting burned
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mb-8 leading-relaxed">
          Reswell runs on trust between buyers and sellers. These quick tips help keep you (and
          everyone else in the community) safe when you meet up, ship a board, or pay for one.
        </p>

        <div className="space-y-6">
          {tips.map((tip) => (
            <Card key={tip.title}>
              <CardHeader>
                <CardTitle className="text-lg">{tip.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{tip.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          If you spot something that breaks our guidelines or looks like a scam, send us a note
          through{" "}
          <Link href="/contact" className="text-primary underline">
            Contact
          </Link>{" "}
          or flag it in Messages. Our{" "}
          <Link href="/terms" className="text-primary underline">
            Terms of Service
          </Link>{" "}
          has more on what&apos;s allowed.
        </p>
      </div>
    </main>
  )
}
