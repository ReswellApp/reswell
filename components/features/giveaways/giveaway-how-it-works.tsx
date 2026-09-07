type GiveawayHowItWorksProps = {
  steps: readonly { title: string; body: string }[]
}

export function GiveawayHowItWorks({ steps }: GiveawayHowItWorksProps) {
  return (
    <section>
      <h2 className="font-headline text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        How to enter
      </h2>
      <ol className="mt-5 space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-listingHeart text-sm font-semibold text-white"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="font-semibold text-foreground">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
