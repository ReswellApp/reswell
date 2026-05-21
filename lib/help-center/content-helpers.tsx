import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"
import type { HelpArticleFigure } from "@/lib/help-center/types"

export function helpLink(href: string, children: ReactNode) {
  return (
    <Link href={href} className="font-medium text-listingHeart underline underline-offset-2">
      {children}
    </Link>
  )
}

export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

export function NumberedSteps({
  steps,
}: {
  steps: { title: string; body: ReactNode }[]
}) {
  return (
    <ol className="mt-4 list-decimal space-y-4 pl-5">
      {steps.map((step) => (
        <li key={step.title}>
          <p className="font-semibold text-neutral-900">{step.title}</p>
          <div className="mt-1 text-neutral-800">{step.body}</div>
        </li>
      ))}
    </ol>
  )
}

export function HelpNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
      {children}
    </div>
  )
}

export function HelpScreenshot({ src, alt, caption }: HelpArticleFigure) {
  return (
    <figure className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 shadow-sm">
      <div className="relative aspect-[16/10] w-full">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top"
          sizes="(max-width: 768px) 100vw, 672px"
        />
      </div>
      {caption ? (
        <figcaption className="border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

/** Shorthand for article section `figure` fields. */
export function helpFigure(
  filename: string,
  alt: string,
  caption?: string,
): HelpArticleFigure {
  return {
    src: `/images/help-center/${filename}`,
    alt,
    caption,
  }
}
