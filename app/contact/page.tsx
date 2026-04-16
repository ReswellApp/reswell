import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Clock, Headphones, Mail, Shield } from "lucide-react"
import { ContactForm } from "./contact-form"
import { pageSeoMetadata } from "@/lib/site-metadata"
import { cn } from "@/lib/utils"

export const metadata = pageSeoMetadata({
  title: "Contact — Reswell",
  description:
    "Reach Reswell support by email or secure message. Timely replies, privacy-first handling, and help with account, orders, and safety.",
  path: "/contact",
})

const trustPoints = [
  {
    icon: Headphones,
    title: "Real people",
    body: "Messages are read by our team—no outsourced scripts when it matters.",
  },
  {
    icon: Clock,
    title: "Predictable follow-up",
    body: "We aim to reply within 1–2 business days. Mark safety or fraud issues as urgent.",
  },
  {
    icon: Shield,
    title: "Privacy-first",
    body: "We use what you send only to help you. We don’t sell your contact details.",
  },
] as const

function TrustCard({
  icon: Icon,
  title,
  body,
  className,
}: {
  icon: (typeof trustPoints)[number]["icon"]
  title: string
  body: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-sm shadow-black/[0.03] dark:shadow-black/20",
        className,
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-foreground tracking-tight">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

export default function ContactPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-border/70 bg-gradient-to-b from-muted/90 via-muted/40 to-background">
        <div className="container mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 md:py-20 lg:px-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Support
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Contact Reswell with confidence
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Whether it’s an order, your account, or something that doesn’t feel right—we’re on it.
            Prefer email or a direct message: both go to the same team.
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-x-12 lg:gap-y-0 lg:px-8 xl:gap-x-16 xl:py-16">
        <div className="lg:col-span-5">
          <div className="space-y-4">
            {trustPoints.map((item) => (
              <TrustCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
            ))}
          </div>

          <Card className="mt-8 overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card to-muted/30 shadow-md shadow-black/[0.06] dark:shadow-black/25">
            <CardContent className="p-6 sm:p-7">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Mail className="h-4 w-4 text-foreground" aria-hidden />
                Email the team
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Best for attachments, forwarding receipts, or when you already live in your inbox.
              </p>
              <a
                href="mailto:help@reswell.app"
                className="mt-5 inline-flex min-h-touch min-w-0 items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-center text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                help@reswell.app
              </a>
            </CardContent>
          </Card>

          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Self-serve first
            </p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Many answers are instant—browse before you write.
            </p>
            <Separator className="my-5" />
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/help"
                  className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Help Center
                </Link>
                <span className="text-muted-foreground"> — FAQs and how Reswell works</span>
              </li>
              <li>
                <Link
                  href="/safety"
                  className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Safety tips
                </Link>
                <span className="text-muted-foreground"> — Meetups, payments, red flags</span>
              </li>
              <li>
                <Link
                  href="/shipping"
                  className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Shipping guide
                </Link>
                <span className="text-muted-foreground"> — Packing and delivery expectations</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 lg:col-span-7 lg:mt-0">
          <ContactForm />
        </div>
      </section>
    </main>
  )
}
