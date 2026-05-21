import { chromium } from "playwright"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const BASE = process.env.HELP_SCREENSHOT_BASE ?? "http://localhost:3001"
const OUT_DIR = path.join(process.cwd(), "public/images/help-center")

const shots = [
  {
    file: "help-center-home.png",
    path: "/help",
    waitFor: "text=Hello, how can we help you?",
    fullPage: false,
  },
  {
    file: "browse-boards.png",
    path: "/boards",
    waitFor: "text=Surfboards",
    fullPage: false,
  },
  {
    file: "sell-flow.png",
    path: "/sell?new=1",
    waitFor: "text=Title",
    fullPage: false,
  },
]

async function findListingPath(page) {
  await page.goto(`${BASE}/boards`, { waitUntil: "networkidle" })
  const href = await page.locator('a[href^="/l/"]').first().getAttribute("href")
  return href
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  const listingPath = await findListingPath(page)
  if (listingPath) {
    shots.push({
      file: "listing-detail.png",
      path: listingPath,
      waitFor: "text=Buy it now",
      fullPage: false,
    })
  }

  for (const shot of shots) {
    const url = `${BASE}${shot.path}`
    console.log(`Capturing ${shot.file} from ${url}`)
    await page.goto(url, { waitUntil: "networkidle" })
    if (shot.waitFor) {
      await page.locator(shot.waitFor).first().waitFor({ timeout: 15000 }).catch(() => {})
    }
    await page.waitForTimeout(800)
    await page.screenshot({
      path: path.join(OUT_DIR, shot.file),
      fullPage: shot.fullPage ?? false,
    })
  }

  await browser.close()
  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
