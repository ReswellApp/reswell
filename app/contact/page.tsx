import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ContactForm } from "./contact-form"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  return resolvePageMetadata("contact")
}

const trustPoints = [
  {
    title: "Real people",
    body: "Your message goes to our actual team, not an outsourced script or a bot.",
  },
  {
    title: "Quick replies",
    body: "We aim to reply within 1 to 2 business days. If it's a safety or fraud issue, flag it as urgent and we'll prioritize it.",
  },
  {
    title: "Your info stays private",
    body: "We only use what you send to help you out. We don't sell your contact details and we don't pass them on.",
  },
] as const

function TrustCard({
  title,
  body,
  className,
}: {
  title: string
  body: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card p-5 shadow-sm shadow-black/[0.03] dark:shadow-black/20",
        className,
      )}
    >
      <p className="font-semibold text-foreground tracking-tight">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

export default function ContactPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 md:py-20 lg:px-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Support
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Get in touch
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Whether it&apos;s about an order, your account, or something that just doesn&apos;t
            feel right, we&apos;re on it. Email us or send a message from this page. Both land
            with the same team.
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-x-12 lg:gap-y-0 lg:px-8 xl:gap-x-16 xl:py-16">
        <div className="lg:col-span-5">
          <div className="space-y-4">
            {trustPoints.map((item) => (
              <TrustCard key={item.title} title={item.title} body={item.body} />
            ))}
          </div>

          <Card className="mt-8 overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card to-muted/30 shadow-md shadow-black/[0.06] dark:shadow-black/25">
            <CardContent className="p-6 sm:p-7">
              <p className="text-sm font-semibold text-foreground">Email the team</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Good for attachments, forwarding receipts, or if you just prefer your inbox.
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
              Try these first
            </p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              A lot of answers are one click away.
            </p>
            <Separator className="my-5" />
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/faq"
                  className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  FAQ
                </Link>
                <span className="text-muted-foreground">, for answers and how Reswell works</span>
              </li>
              <li>
                <Link
                  href="/safety"
                  className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Safety tips
                </Link>
                <span className="text-muted-foreground">, for meetups, payments, and red flags</span>
              </li>
              <li>
                <Link
                  href="/shipping"
                  className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Shipping guide
                </Link>
                <span className="text-muted-foreground">, for packing and delivery</span>
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
