/**
 * Comprehensive brand logo downloader
 * Downloads logos for all brands missing them from their websites
 * 
 * Run with: npx tsx scripts/download-all-brand-logos.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Next_Public_Supabase_Url
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.Supabase_Service_Role_Key

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'brand-logos')

type Brand = {
  slug: string
  name: string
  website_url: string | null
}

// Known logo URLs for specific brands
const KNOWN_LOGOS: Record<string, string> = {
  // Official header mark (Almond-Logo_300x.png 404s and previously saved as HTML).
  'almond-surfboards': 'https://cdn.shopify.com/s/files/1/0586/9682/6965/files/Almond-Diamond.svg?v=1757971113',
  'lib-tech-surfboards': 'https://www.lib-tech.com/static/version1780486653/frontend/Mervin/libtech/en_US/images/logo.svg',
  'nsp-surfboards': 'https://www.nspsurfboards.com/wp-content/uploads/2024/11/NSP-Logo-White-spaced-out-V03.webp',
  'torq-surfboards': 'https://www.torqsurfboards.com/wp-content/uploads/2019/08/torq-logo.png',
  'softech-surfboards': 'https://softechsurfboards.com/cdn/shop/files/Softech_Surfboards_Logo_200x.png',
  'walden-surfboards': 'https://www.waldensurfboards.com/cdn/shop/files/Walden-Surfboards-Logo_300x.png',
  'hobie-surfboards': 'https://www.hobie.com/assets/images/hobie-logo.svg',
  'harbour-surfboards': 'https://harboursurfboards.com/cdn/shop/files/harbour-logo.png',
  'takayama-surfboards': 'https://takayamasurfboards.com/cdn/shop/files/takayama-logo.png',
  'stewart-surfboards': 'https://www.stewartsurfboards.com/cdn/shop/files/stewart-logo.png',
  'emery-surfboards': 'https://emerysurfboards.com/cdn/shop/files/emery-logo.png',
  'infinity-surfboards': 'https://infinitysurfboards.com/cdn/shop/files/infinity-logo.png',
  'gordon-and-smith': 'https://www.gordonandsmith.com/cdn/shop/files/gs-logo.png',
  'webber-surfboards': 'https://webbersurfboards.com/cdn/shop/files/webber-logo.png',
  'cj-nelson-designs': 'https://cjnelsondesigns.com/cdn/shop/files/cj-nelson-logo.png',
  'machado-surfboards': 'https://www.machadosurfboards.com/cdn/shop/files/machado-logo.png',
  'stretch-boards': 'https://stretchboards.com/cdn/shop/files/stretch-logo.png',
  'modern-surfboards': 'https://modernsurfboards.com/cdn/shop/files/modern-logo.png',
  'superbrand-surfboards': 'https://superbrandsurfboards.com/cdn/shop/files/superbrand-logo.png',
  'pukas-surfboards': 'https://www.pukassurfboards.com/cdn/shop/files/pukas-logo.png',
  'simon-anderson-surfboards': 'https://simonandersonsurfboards.com/cdn/shop/files/simon-anderson-logo.png',
  'maurice-cole-surfboards': 'https://mauricecolesurfboards.com/cdn/shop/files/maurice-cole-logo.png',
  'timmy-patterson-surfboards': 'https://timmypattersonsurfboards.com/cdn/shop/files/timmy-patterson-logo.png',
  'mark-richards-surfboards': 'https://markrichardssurfboards.com/cdn/shop/files/mr-logo.png',
}

function getLogoExtension(url: string): string {
  if (url.includes('.svg')) return 'svg'
  if (url.includes('.webp')) return 'webp'
  if (url.includes('.jpg') || url.includes('.jpeg')) return 'jpg'
  return 'png'
}

async function downloadLogo(brand: Brand, url: string): Promise<boolean> {
  try {
    const ext = getLogoExtension(url)
    const filename = `${brand.slug}.${ext}`
    const outputPath = path.join(OUTPUT_DIR, filename)
    
    const { stdout, stderr } = await execAsync(
      `curl -L -A "Mozilla/5.0" --max-time 10 -o "${outputPath}" "${url}" 2>&1`
    )
    
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath)
      if (stats.size > 200) {
        console.log(`✅ ${brand.name} (${brand.slug}.${ext}) - ${(stats.size / 1024).toFixed(1)}KB`)
        return true
      } else {
        fs.unlinkSync(outputPath)
      }
    }
  } catch (error) {
    // Failed
  }
  return false
}

async function tryDownloadFromWebsite(brand: Brand): Promise<boolean> {
  if (!brand.website_url) return false
  
  const domain = brand.website_url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  
  // Try common logo patterns
  const patterns = [
    `https://${domain}/cdn/shop/files/logo.png`,
    `https://${domain}/cdn/shop/files/Logo.png`,
    `https://${domain}/cdn/shop/files/${brand.slug}.png`,
    `https://${domain}/cdn/shop/files/logo.svg`,
    `https://${domain}/wp-content/uploads/logo.png`,
    `https://${domain}/images/logo.png`,
    `https://${domain}/assets/logo.png`,
    `https://${domain}/img/logo.png`,
    `https://${domain}/logo.png`,
  ]
  
  for (const url of patterns) {
    if (await downloadLogo(brand, url)) {
      return true
    }
  }
  
  return false
}

async function main() {
  console.log('🚀 Starting comprehensive brand logo download...\n')
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  
  // Get all brands without logos
  const { data: brands } = await supabase
    .from('brands')
    .select('slug, name, website_url, logo_url')
    .order('name')
  
  const missingLogos = (brands || []).filter(
    (b: any) => !b.logo_url || b.logo_url.trim() === ''
  )
  
  console.log(`📊 Found ${missingLogos.length} brands without logos\n`)
  console.log(`Starting downloads...\n`)
  
  let successful = 0
  let failed = 0
  const failedBrands: string[] = []
  
  for (const brand of missingLogos) {
    // Try known URL first
    if (KNOWN_LOGOS[brand.slug]) {
      if (await downloadLogo(brand, KNOWN_LOGOS[brand.slug])) {
        successful++
        continue
      }
    }
    
    // Try auto-discovery
    if (await tryDownloadFromWebsite(brand)) {
      successful++
    } else {
      failed++
      failedBrands.push(brand.name)
      console.log(`❌ ${brand.name} - no logo found`)
    }
  }
  
  console.log(`\n📊 Results:`)
  console.log(`  ✅ Successfully downloaded: ${successful}`)
  console.log(`  ❌ Failed: ${failed}`)
  
  if (failedBrands.length > 0) {
    console.log(`\n⚠️  Failed brands (${failedBrands.length}):`)
    failedBrands.forEach(name => console.log(`  - ${name}`))
  }
  
  console.log(`\n✨ Next step: Run upload-brand-logos.ts to upload to Supabase`)
}

main().catch(console.error)
