import Image from "next/image"
import { portraitShimmer } from "@/lib/image-shimmer"

type FounderProfileData = {
  name: string
  role: string
  title?: string
  imageSrc?: string
  imageAlt?: string
}

const FOUNDERS: readonly FounderProfileData[] = [
  {
    name: "Hayden Garfield",
    role: "Co-founder",
    title: "CEO & Full Stack Engineer",
  },
  {
    name: "David Kalt",
    role: "Co-founder",
    title: "Full Stack Engineer",
    imageSrc: "/images/about/david-kalt.png",
    imageAlt: "David Kalt, co-founder of Reswell",
  },
]

function FounderProfile({ name, role, title, imageSrc, imageAlt }: FounderProfileData) {
  return (
    <article className="flex flex-col items-center text-center">
      {imageSrc && imageAlt ? (
        <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-sm sm:h-40 sm:w-40">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover object-center"
            sizes="(max-width: 640px) 144px, 160px"
            placeholder="blur"
            blurDataURL={portraitShimmer}
          />
        </div>
      ) : null}
      <div className={imageSrc ? "mt-5 max-w-xs" : "max-w-xs"}>
        <h3 className="font-headline text-xl font-bold tracking-tight text-foreground">{name}</h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {role}
        </p>
        {title ? (
          <p className="mt-1.5 text-sm font-medium text-foreground">{title}</p>
        ) : null}
      </div>
    </article>
  )
}

export function AboutFoundersSection() {
  return (
    <section className="border-b border-border/70 bg-background" aria-labelledby="about-founders-heading">
      <div className="container mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="about-founders-heading"
            className="font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Meet the founders
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            A small team building the marketplace we wished existed.
          </p>
        </div>

        <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-10 sm:flex-row sm:justify-center sm:gap-16 lg:gap-20">
          {FOUNDERS.map((founder) => (
            <FounderProfile key={founder.name} {...founder} />
          ))}
        </div>
      </div>
    </section>
  )
}
