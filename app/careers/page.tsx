import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CAREERS_APPLY_EMAIL,
  CAREERS_APPLY_MAILTO,
  careerRoles,
} from "@/lib/careers"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export const revalidate = 86400

export async function generateMetadata() {
  return resolvePageMetadata("careers")
}

export default function CareersPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16 md:py-20">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Team
          </p>
          <h1 className="mt-3 font-headline text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Careers
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            Reswell is the peer-to-peer marketplace for surfers. We&apos;re a small team in Santa
            Barbara building nationwide buying and selling with shipping and Purchase Protection
            baked in.
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
          Open roles
        </h2>

        {careerRoles.length > 0 ? (
          <ul className="mt-6 space-y-4">
            {careerRoles.map((role) => (
              <li key={role.slug} id={role.slug}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{role.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {role.type} · {role.location}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{role.summary}</p>
                    <Button className="mt-5" asChild>
                      <a href={CAREERS_APPLY_MAILTO}>Apply</a>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            We don&apos;t have a listed opening right now. If you think you should be here anyway,
            send a short note — we read every one.
          </p>
        )}

        <div className="mt-10 rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-7">
          <p className="font-semibold text-foreground">How to apply</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Email a short note and a resume or relevant link. Tell us what you&apos;d want to work
            on.
          </p>
          <Button className="mt-5" asChild>
            <a href={CAREERS_APPLY_MAILTO}>{CAREERS_APPLY_EMAIL}</a>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Or reach us through{" "}
            <Link href="/contact" className="font-medium text-foreground underline underline-offset-4">
              Contact
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
