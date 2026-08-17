/**
 * Attempt to auto-download logos for brands missing them
 * This tries common logo URL patterns for each brand
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

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'brand-logos')

type Brand = {
  slug: string
  name: string
  website_url: string | null
}

// Try common logo URL patterns
function generateLogoUrls(brand: Brand): string[] {
  if (!brand.website_url) return []
  
  const domain = brand.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const urls: string[] = []
  
  // Shopify CDN patterns
  urls.push(`https://${domain}/cdn/shop/files/logo.png`)
  urls.push(`https://${domain}/cdn/shop/files/Logo.png`)
  urls.push(`https://${domain}/cdn/shop/files/logo.svg`)
  
  // WordPress patterns
  urls.push(`https://${domain}/wp-content/uploads/logo.png`)
  urls.push(`https://${domain}/wp-content/themes/*/images/logo.png`)
  
  // Common paths
  urls.push(`https://${domain}/images/logo.png`)
  urls.push(`https://${domain}/assets/logo.png`)
  urls.push(`https://${domain}/img/logo.png`)
  
  return urls
}

async function tryDownloadLogo(brand: Brand): Promise<string | null> {
  const urls = generateLogoUrls(brand)
  
  for (const url of urls) {
    try {
      const filename = `${brand.slug}.png`
      const outputPath = path.join('/tmp/auto-logos', filename)
      
      const { stderr } = await execAsync(
        `wget --user-agent="Mozilla/5.0" --timeout=5 --tries=1 -q -O "${outputPath}" "${url}"`
      )
      
      // Check if file exists and has content
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath)
        if (stats.size > 100) { // At least 100 bytes
          console.log(`✅ ${brand.name}: ${url}`)
          return outputPath
        }
        fs.unlinkSync(outputPath)
      }
    } catch (error) {
      // Try next URL
    }
  }
  
  console.log(`❌ ${brand.name}: No logo found`)
  return null
}

async function main() {
  // Create temp directory
  if (!fs.existsSync('/tmp/auto-logos')) {
    fs.mkdirSync('/tmp/auto-logos', { recursive: true })
  }
  
  // Get brands without logos
  const { data: brands } = await supabase
    .from('brands')
    .select('slug, name, website_url, logo_url')
    .order('name')
  
  const missingLogos = (brands || []).filter(
    (b: any) => !b.logo_url || b.logo_url.trim() === ''
  )
  
  console.log(`\n🔍 Found ${missingLogos.length} brands without logos\n`)
  console.log(`Attempting auto-download...\n`)
  
  const results = []
  for (const brand of missingLogos.slice(0, 20)) { // Start with first 20
    const logoPath = await tryDownloadLogo(brand)
    if (logoPath) {
      results.push({ brand, logoPath })
    }
  }
  
  console.log(`\n📊 Downloaded ${results.length} out of ${Math.min(20, missingLogos.length)} attempted`)
}

main().catch(console.error)
