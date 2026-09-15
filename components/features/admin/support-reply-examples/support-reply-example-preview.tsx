import Link from "next/link"
import type { SupportReplyExampleAdminView } from "@/lib/types/supportReplyDraft"

interface SupportReplyExamplePreviewProps {
  example: SupportReplyExampleAdminView
}

export function SupportReplyExamplePreview({ example }: SupportReplyExamplePreviewProps) {
  return (
    <>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Customer
        </p>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {example.customerExcerpt || "—"}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Staff reply
        </p>
        <p className="whitespace-pre-wrap text-sm">{example.staffReply}</p>
      </div>
      {example.citedHelp.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          From help:{" "}
          {example.citedHelp.map((article, index) => (
            <span key={article.slug}>
              {index > 0 ? ", " : null}
              <Link href={article.href} className="underline-offset-4 hover:underline">
                {article.title}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </>
  )
}
