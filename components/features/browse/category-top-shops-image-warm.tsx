"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react"

const CategoryTopShopsImageWarmContext = createContext(false)

/** True once the top-shops strip is near the viewport (or already on screen). */
export function useCategoryTopShopsImageWarm(): boolean {
  return useContext(CategoryTopShopsImageWarmContext)
}

/**
 * Starts warm when the carousel is within ~800px of the viewport so all tile
 * images can eager-fetch (and hit HTTP cache) before horizontal scroll.
 */
export function CategoryTopShopsImageWarmProvider({
  scrollRef,
  children,
}: {
  scrollRef: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const [warm, setWarm] = useState(false)

  useEffect(() => {
    if (warm) return
    const el = scrollRef.current
    if (!el) return

    const markWarm = () => setWarm(true)

    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight
    if (rect.top < vh + 800 && rect.bottom > -800) {
      markWarm()
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          markWarm()
          observer.disconnect()
        }
      },
      { rootMargin: "800px 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRef, warm])

  return (
    <CategoryTopShopsImageWarmContext.Provider value={warm}>
      {children}
    </CategoryTopShopsImageWarmContext.Provider>
  )
}
