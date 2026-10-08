import { useColorScheme } from "react-native"

/** Matches `app/globals.css` — light canvas, near-black ink, muted slate. */
export const lightColors = {
  background: "#FFFFFF",
  foreground: "#04070E",
  muted: "#65748B",
  border: "#E2E8F0",
  card: "#FFFFFF",
  image: "#F3F4F6",
  primary: "#04070E",
  primaryForeground: "#FFFFFF",
  shipping: "#4263EB",
  destructive: "#DC2626",
}

export const darkColors = {
  background: "#121212",
  foreground: "#FAFAFA",
  muted: "#A6A6A6",
  border: "#333333",
  card: "#1A1A1A",
  image: "#2A2A2A",
  primary: "#FAFAFA",
  primaryForeground: "#04070E",
  shipping: "#4263EB",
  destructive: "#D4D4D4",
}

export type ReswellColors = typeof lightColors

export const fontFamily = {
  text: "StackSansText",
  headline: "StackSansHeadline",
} as const

export function useReswellColors(): ReswellColors {
  return useColorScheme() === "dark" ? darkColors : lightColors
}
