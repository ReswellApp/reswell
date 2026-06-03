"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useBoardsBrowseRouter } from "@/hooks/use-boards-browse-router"

type BoardsBrowsePaginationProps = {
  page: number
  totalPages: number
}

/** Prevent search/filter inputs from blurring (and re-syncing the URL) before the click runs. */
function preventBlurBeforeClick(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault()
}

export function BoardsBrowsePagination({ page, totalPages }: BoardsBrowsePaginationProps) {
  const { navigate } = useBoardsBrowseRouter()
  const [isPending, startTransition] = useTransition()

  if (totalPages <= 1) return null

  const goToPage = (pageNum: number) => {
    startTransition(() => {
      navigate(
        (params) => {
          if (pageNum <= 1) params.delete("page")
          else params.set("page", String(pageNum))
        },
        { resetPage: false },
      )
    })
  }

  return (
    <div
      className={cn(
        "mt-8 flex justify-center gap-2 transition-opacity duration-200",
        isPending && "opacity-70",
      )}
      aria-busy={isPending}
    >
      {page > 1 ? (
        <Button
          type="button"
          variant="outline"
          onMouseDown={preventBlurBeforeClick}
          onClick={() => goToPage(page - 1)}
        >
          Previous
        </Button>
      ) : null}
      <span className="flex items-center px-4 text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Button
          type="button"
          variant="outline"
          onMouseDown={preventBlurBeforeClick}
          onClick={() => goToPage(page + 1)}
        >
          Next
        </Button>
      ) : null}
    </div>
  )
}
