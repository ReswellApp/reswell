/**
 * Quick-fill rows for the sell-flow shipping estimator (weight + outer box inches).
 * Not used for rating logic — display and preset application only.
 */

export type ExampleMeasurementRow = {
  id: string
  title: string
  /** Summary line like "14 lb — 72 × 20 × 6 in" */
  summary: string
  weightLb: number
  lengthIn: number
  widthIn: number
  heightIn: number
}

export const EXAMPLE_SURFBOARD_MEASUREMENTS: ExampleMeasurementRow[] = [
  {
    id: "short",
    title: "Shortboard",
    summary: "14 lb — 72 × 20 × 6 in",
    weightLb: 14,
    lengthIn: 72,
    widthIn: 20,
    heightIn: 6,
  },
  {
    id: "hybrid",
    title: "Hybrid / fish",
    summary: "18 lb — 76 × 21 × 7 in",
    weightLb: 18,
    lengthIn: 76,
    widthIn: 21,
    heightIn: 7,
  },
  {
    id: "mid",
    title: "Mid-length",
    summary: "24 lb — 84 × 22 × 8 in",
    weightLb: 24,
    lengthIn: 84,
    widthIn: 22,
    heightIn: 8,
  },
  {
    id: "long",
    title: "Longboard",
    summary: "32 lb — 96 × 24 × 9 in",
    weightLb: 32,
    lengthIn: 96,
    widthIn: 24,
    heightIn: 9,
  },
  {
    id: "sup",
    title: "SUP (boxed)",
    summary: "45 lb — 132 × 34 × 12 in",
    weightLb: 45,
    lengthIn: 132,
    widthIn: 34,
    heightIn: 12,
  },
  {
    id: "travel",
    title: "Travel / coffin",
    summary: "38 lb — 102 × 28 × 10 in",
    weightLb: 38,
    lengthIn: 102,
    widthIn: 28,
    heightIn: 10,
  },
]
