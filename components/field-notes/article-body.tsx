import type { ArticleBlock } from "@/lib/field-notes-articles"

export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        if (block.kind === "h2") {
          return (
            <h2
              key={i}
              className="pt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
            >
              {block.text}
            </h2>
          )
        }
        return (
          <p key={i} className="text-[17px] leading-[1.75] text-muted-foreground sm:text-lg sm:leading-relaxed">
            {block.text}
          </p>
        )
      })}
    </div>
  )
}
