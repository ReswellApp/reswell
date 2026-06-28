"use client"

import { createContext, useContext, type ReactNode } from "react"

type BoardTalkForumsUiValue = {
  openNewThread: () => void
}

const BoardTalkForumsUiContext = createContext<BoardTalkForumsUiValue | null>(null)

export function BoardTalkForumsUiProvider({
  value,
  children,
}: {
  value: BoardTalkForumsUiValue
  children: ReactNode
}) {
  return <BoardTalkForumsUiContext.Provider value={value}>{children}</BoardTalkForumsUiContext.Provider>
}

export function useBoardTalkForumsUi(): BoardTalkForumsUiValue | null {
  return useContext(BoardTalkForumsUiContext)
}
