import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import {
  CAREERS_APPLY_EMAIL,
  CAREERS_APPLY_MAILTO,
  careerRoleHref,
  careerRoleTypeLabel,
  careerRoles,
} from "@/lib/careers"
import { wideShimmer } from "@/lib/image-shimmer"
import careersHeadlineAtmosphere from "@/public/images/careers/headline-barrel.jpg"

export function CareersPageContent() {
  return (
    <>
      <section className="relative isolate h-[min(72vh,44rem)] min-h-[22rem] w-full overflow-hidden">
        <Image
          src={careersHeadlineAtmosphere}
          alt=""
          fill
          priority
          quality={95}
          sizes="100vw"
          className="object-cover object-center"
          placeholder="blur"
          blurDataURL={wideShimmer}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-black/35" aria-hidden />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
          <h1 className="font-headline text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-tight text-white">
            Reswell Careers
          </h1>
          <p className="mt-3 text-sm font-medium tracking-wide text-white/85 sm:text-base">
            We&apos;re new, the feeling isn&apos;t.
          </p>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            We&apos;re a small Santa Barbara team putting used boards back in the water. If you
            know boards, like talking to people, and would rather be in a shop or on the road than
            at a desk, look through the openings.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
            <h2 className="font-headline text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
              Current openings
            </h2>
            <p className="text-sm text-muted-foreground">{careerRoles.length}</p>
          </div>

          {careerRoles.length > 0 ? (
            <>
              <div className="hidden border-b border-border/70 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_1.5rem] md:gap-4">
                <span>Role</span>
                <span>Location</span>
                <span>Department</span>
                <span>Type</span>
                <span className="sr-only">Open</span>
              </div>
              <ul>
                {careerRoles.map((role) => (
                  <li key={role.slug} className="border-b border-border/70">
                    <Link
                      href={careerRoleHref(role)}
                      className="group grid gap-1 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_1.5rem] md:items-center md:gap-4"
                    >
                      <span className="font-headline text-lg font-semibold tracking-tight text-foreground group-hover:underline">
                        {role.title}
                      </span>
                      <span className="text-sm text-muted-foreground">{role.location}</span>
                      <span className="hidden text-sm text-muted-foreground md:block">
                        {role.department}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {careerRoleTypeLabel(role)}
                      </span>
                      <ChevronRight
                        className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              No listed opening right now. If you think you should be here anyway, send a short
              note.
            </p>
          )}

          <p className="mt-12 text-sm leading-relaxed text-muted-foreground">
            Email{" "}
            <a
              href={CAREERS_APPLY_MAILTO}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {CAREERS_APPLY_EMAIL}
            </a>{" "}
            or use{" "}
            <Link href="/contact" className="font-medium text-foreground underline underline-offset-4">
              Contact
            </Link>
            .
          </p>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Reswell is an equal opportunity employer.
          </p>
        </div>
      </section>
    </>
  )
}
