"use client"

import Image from "next/image"
import Link from "next/link"
import { getHelpCenterTabs } from "@/lib/help-center/registry"
import { helpTopicSectionPath } from "@/lib/help-center/paths"
import type { HelpCenterTabId } from "@/lib/help-center/types"
import { HelpCenterSearch } from "@/components/features/help-center/help-center-search"
import { cn } from "@/lib/utils"

const tabs = getHelpCenterTabs()

type HelpCenterHeroProps = {
  activeTab: HelpCenterTabId
  onTabChange: (tab: HelpCenterTabId) => void
}

export function HelpCenterHero({ activeTab, onTabChange }: HelpCenterHeroProps) {
  const tab = tabs.find((t) => t.id === activeTab) ?? tabs[0]

  return (
    <section className="bg-white px-4 pb-12 pt-10 sm:px-6 sm:pt-14 sm:pb-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-headline text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Hello, how can we help you?
        </h1>

        <div className="relative mx-auto mt-8 max-w-2xl">
          <HelpCenterSearch />
        </div>
      </div>

      <nav
        className="mx-auto mt-10 flex max-w-md justify-center gap-8 sm:gap-12"
        aria-label="Help topics"
      >
        {tabs.map((t) => {
          const isActive = t.id === activeTab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "relative pb-3 text-sm font-medium transition-colors sm:text-base",
                isActive ? "font-bold text-neutral-900" : "text-neutral-900 hover:text-neutral-600",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {t.label}
              {isActive ? (
                <span
                  className="absolute bottom-0 left-0 right-0 h-1 rounded-full bg-listingHeart"
                  aria-hidden
                />
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-3 sm:gap-8">
        {tab.categories.map((category) => (
          <Link
            key={category.sectionSlug}
            href={helpTopicSectionPath(tab.id, category.sectionSlug)}
            className="group block rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-4"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100">
              <Image
                src={category.imageSrc}
                alt={category.imageAlt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 100vw, 33vw"
              />
            </div>
            <p className="mt-3 text-base font-bold text-neutral-900 sm:text-lg">{category.title}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          href={tab.allArticlesHref}
          className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          {tab.allArticlesLabel}
        </Link>
      </div>
    </section>
  )
}
