import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "public/images/dropoff/meta-ads")
const tmpDir = join(root, ".tmp/meta-ads")
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const photo = join(root, "public/images/cities/santa-barbara-mesa-lane.jpg")
const headline = join(root, "fonts/stack-sans-headline-latin.woff2")
const text = join(root, "fonts/stack-sans-text-latin.woff2")

const css = `
@font-face {
  font-family: "StackSansHeadline";
  src: url("file://${headline}") format("woff2");
  font-weight: 200 700;
  font-style: normal;
}
@font-face {
  font-family: "StackSansText";
  src: url("file://${text}") format("woff2");
  font-weight: 200 700;
  font-style: normal;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 1350px; overflow: hidden; background: #001A4A; }
.slide { width: 1080px; height: 1350px; position: relative; overflow: hidden; font-family: "StackSansText", Helvetica, sans-serif; }
.eyebrow { font-weight: 600; font-variation-settings: "wght" 600; font-size: 22px; letter-spacing: 0.2em; text-transform: uppercase; }
h1, h2, .num, .step-title { font-family: "StackSansHeadline", Helvetica, sans-serif; font-weight: 700; font-variation-settings: "wght" 700; letter-spacing: -0.04em; line-height: 1.02; }
.photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 38% 55%; }
.sp { display: inline-block; width: 0.28em; }
.sp-sm { display: inline-block; width: 0.22em; }
`

const sp = (text, cls = "sp") =>
  text
    .split(/(\s+)/)
    .map((part) => (part.trim() === "" ? `<span class="${cls}"></span>` : part))
    .join("")


const slides = {
  "01-hook": `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<section class="slide">
  <img class="photo" src="file://${photo}" alt="" />
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,26,74,0.12) 0%,rgba(0,26,74,0.22) 40%,rgba(0,26,74,0.82) 100%);"></div>
  <div style="position:absolute;left:72px;right:72px;bottom:96px;color:#fff;">
    <p class="eyebrow" style="color:rgba(255,255,255,0.7);margin-bottom:22px;">${sp("Santa Barbara · Reswell", "sp-sm")}</p>
    <h1 style="font-size:92px;max-width:920px;">${sp("Board sitting around?")}</h1>
    <p style="margin-top:28px;font-size:36px;line-height:1.28;font-weight:400;color:rgba(255,255,255,0.9);max-width:840px;">
      ${sp("Drop it off in Santa Barbara. We pack and ship it nationwide.")}
    </p>
    <p style="margin-top:26px;font-size:26px;color:rgba(255,255,255,0.68);">
      ${sp("No box. No label. We send the spot after it sells.")}
    </p>
  </div>
</section></body></html>`,

  "02-how-it-works": `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<section class="slide" style="background:#F4F7FB;color:#001A4A;">
  <img src="file://${photo}" alt="" style="width:1080px;height:390px;object-fit:cover;object-position:38% 58%;display:block;" />
  <div style="padding:52px 72px 0;">
    <p class="eyebrow" style="color:#5574AD;margin-bottom:14px;">${sp("How it works", "sp-sm")}</p>
    <h2 style="font-size:58px;margin-bottom:36px;">${sp("Three easy steps.")}</h2>
    <ol style="list-style:none;display:flex;flex-direction:column;gap:30px;">
      <li style="display:flex;gap:26px;align-items:flex-start;">
        <span class="num" style="font-size:56px;color:#355185;line-height:0.9;width:58px;">1</span>
        <div>
          <p class="step-title" style="font-size:36px;">${sp("List it. Pick Santa Barbara.")}</p>
          <p style="margin-top:8px;font-size:26px;line-height:1.35;color:#5c6b89;">${sp("Choose drop-off when you list. No box size to enter.")}</p>
        </div>
      </li>
      <li style="display:flex;gap:26px;align-items:flex-start;">
        <span class="num" style="font-size:56px;color:#355185;line-height:0.9;width:58px;">2</span>
        <div>
          <p class="step-title" style="font-size:36px;">${sp("It sells. We send the spot.")}</p>
          <p style="margin-top:8px;font-size:26px;line-height:1.35;color:#5c6b89;">${sp("Location stays private until a buyer checks out.")}</p>
        </div>
      </li>
      <li style="display:flex;gap:26px;align-items:flex-start;">
        <span class="num" style="font-size:56px;color:#355185;line-height:0.9;width:58px;">3</span>
        <div>
          <p class="step-title" style="font-size:36px;">${sp("Drop it off. We ship it.")}</p>
          <p style="margin-top:8px;font-size:26px;line-height:1.35;color:#5c6b89;">${sp("We pack the board and send it to the buyer.")}</p>
        </div>
      </li>
    </ol>
  </div>
</section></body></html>`,

  "03-nationwide": `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<section class="slide" style="background:#F9F9F2;color:#001A4A;padding:96px 72px 80px;">
  <p class="eyebrow" style="color:#5574AD;margin-bottom:28px;">${sp("If it hasn’t sold locally", "sp-sm")}</p>
  <h2 style="font-size:76px;max-width:920px;">${sp("That’s a pretty good reason to offer shipping.")}</h2>
  <p style="margin-top:36px;font-size:34px;line-height:1.38;color:#5c6b89;max-width:860px;">
    ${sp("A board that sits in town might be exactly what someone in another state is hunting.")}
  </p>
  <div style="margin-top:56px;background:#fff;border-radius:36px;padding:40px 42px;">
    <p class="step-title" style="font-size:34px;">${sp("You drop it off in Santa Barbara.")}</p>
    <p style="margin-top:12px;font-size:28px;line-height:1.35;color:#5c6b89;">
      ${sp("The buyer can be anywhere we ship. No boxing it yourself.")}
    </p>
  </div>
  <p style="position:absolute;left:72px;bottom:80px;font-size:24px;color:#5574AD;">
    ${sp("Reswell · used surfboards")}
  </p>
</section></body></html>`,

  "04-cta": `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<section class="slide" style="background:#001A4A;color:#fff;">
  <img class="photo" src="file://${photo}" alt="" />
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,26,74,0.28) 0%,rgba(0,26,74,0.78) 52%,#001A4A 100%);"></div>
  <div style="position:absolute;left:72px;right:72px;bottom:104px;">
    <p class="eyebrow" style="color:rgba(255,255,255,0.62);margin-bottom:22px;">${sp("Free to post", "sp-sm")}</p>
    <h2 style="font-size:84px;max-width:900px;">${sp("List it and choose Santa Barbara.")}</h2>
    <p style="margin-top:28px;font-size:34px;line-height:1.35;color:rgba(255,255,255,0.82);max-width:800px;">
      ${sp("After it sells, drop it off. We pack and ship it.")}
    </p>
    <div style="margin-top:44px;display:inline-block;background:#fff;color:#001A4A;border-radius:999px;padding:22px 38px;font-weight:700;font-size:28px;">
      reswell.com/dropoff/santa-barbara
    </div>
  </div>
</section></body></html>`,
}

mkdirSync(tmpDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

for (const [name, html] of Object.entries(slides)) {
  const htmlPath = join(tmpDir, `${name}.html`)
  const pngPath = join(tmpDir, `${name}.png`)
  const jpgPath = join(outDir, `${name}.jpg`)
  writeFileSync(htmlPath, html)
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1080,1350",
    `--screenshot=${pngPath}`,
    "--virtual-time-budget=4000",
    `file://${htmlPath}`,
  ], { stdio: "inherit" })
  await sharp(pngPath)
    .resize(1080, 1350, { fit: "cover" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(jpgPath)
  console.log("wrote", jpgPath)
}
