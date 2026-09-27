import {
  KLAVIYO_EMAIL_FONT_HEADLINE,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_PALETTE,
} from "@/lib/klaviyo/email-brand-styles"

function expandHex(hex: string): string {
  const raw = hex.replace("#", "")
  const full = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw
  return `#${full.toUpperCase()}`
}

function channel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
}

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  red: "#FF0000",
  blue: "#0000FF",
  green: "#008000",
  yellow: "#FFFF00",
  orange: "#FFA500",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
  silver: "#C0C0C0",
  navy: "#000080",
  teal: "#008080",
  aqua: "#00FFFF",
  fuchsia: "#FF00FF",
  maroon: "#800000",
  olive: "#808000",
  lime: "#00FF00",
}

function nearestPaletteColor(hex: string): string {
  const target = expandHex(hex)
  if ((KLAVIYO_EMAIL_PALETTE as readonly string[]).includes(target)) return target
  let best: string = KLAVIYO_EMAIL_PALETTE[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const color of KLAVIYO_EMAIL_PALETTE) {
    const distance = [0, 1, 2].reduce((sum, index) => {
      const delta = channel(target, index) - channel(color, index)
      return sum + delta * delta
    }, 0)
    if (distance < bestDistance) {
      best = color
      bestDistance = distance
    }
  }
  return best
}

function remapColorToken(token: string): string {
  const trimmed = token.trim()
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return nearestPaletteColor(trimmed)
  const rgb = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i)
  if (rgb?.[1] && rgb[2] && rgb[3]) {
    const hex = `#${[rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`
    return nearestPaletteColor(hex)
  }
  const named = NAMED_COLORS[trimmed.toLowerCase()]
  return named ? nearestPaletteColor(named) : trimmed
}

function sanitizeCss(css: string): string {
  const fonts = css.replace(/font-family\s*:\s*[^;]+/gi, (declaration) => {
    return /headline/i.test(declaration)
      ? `font-family:${KLAVIYO_EMAIL_FONT_HEADLINE}`
      : `font-family:${KLAVIYO_EMAIL_FONT_SANS}`
  })
  const hexes = fonts.replace(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g, (hex) => nearestPaletteColor(hex))
  const rgb = hexes.replace(/rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}[^)]*\)/gi, (value) => remapColorToken(value))
  return rgb.replace(/\b(?:red|blue|green|yellow|orange|purple|black|white|gray|grey|silver|navy|teal|aqua|fuchsia|maroon|olive|lime)\b/gi, (name) => remapColorToken(name))
}

/** Force custom email HTML onto the Reswell palette and Stack Sans. */
export function sanitizeEmailHtml(html: string): string {
  const styled = html.replace(/style=(["'])([\s\S]*?)\1/gi, (_match, quote: string, css: string) => {
    return `style=${quote}${sanitizeCss(css)}${quote}`
  })
  const blocks = styled.replace(/<style>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
    return `<style>${sanitizeCss(css)}</style>`
  })
  return blocks.replace(/\b(bgcolor|color)=(["'])([^"']+)\2/gi, (_match, attr: string, quote: string, value: string) => {
    return `${attr}=${quote}${remapColorToken(value)}${quote}`
  })
}
