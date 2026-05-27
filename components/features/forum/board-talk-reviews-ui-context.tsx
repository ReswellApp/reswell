"use client"

import { createContext, useContext } from "react"

type BoardTalkReviewsUiContextValue = {
  openPostReview: () => void
}

const BoardTalkReviewsUiContext = createContext<BoardTalkReviewsUiContextValue | null>(null)

export function BoardTalkReviewsUiProvider({
  value,
  children,
}: {
  value: BoardTalkReviewsUiContextValue | null
  children: React.ReactNode
}) {
  return (
    <BoardTalkReviewsUiContext.Provider value={value}>{children}</BoardTalkReviewsUiContext.Provider>
  )
}

export function useBoardTalkReviewsUi(): BoardTalkReviewsUiContextValue | null {
  return useContext(BoardTalkReviewsUiContext)
}
