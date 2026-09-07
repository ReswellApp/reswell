/**
 * Upload brand logos to Supabase storage
 * 
 * Prerequisites:
 * 1. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * 2. Ensure brand-assets storage bucket exists in Supabase
 * 3. Logos should be in public/brand-logos/ folder
 * 
 * Run with: npx tsx scripts/upload-brand-logos.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Support both standard and Cursor Cloud Agent env var naming
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Next_Public_Supabase_Url
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.Supabase_Service_Role_Key

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL (or Next_Public_Supabase_Url)')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY (or Supabase_Service_Role_Key)')
  console.error('\nSet these in .env.local or export them in your shell.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const LOGO_DIR = path.join(process.cwd(), 'public', 'brand-logos')
const BUCKET = 'brand-assets'

type BrandLogo = {
  slug: string
  filename: string
  storagePath: string
  contentType: string
}

const brandLogos: BrandLogo[] = [
  { slug: 'alkali-fins', filename: 'alkali-fins.png', storagePath: 'logos/alkali-fins.png', contentType: 'image/png' },
  { slug: 'almond-surfboards', filename: 'almond-surfboards.png', storagePath: 'logos/almond-surfboards.png', contentType: 'image/png' },
  { slug: 'becker-surfboards', filename: 'becker-surfboards.svg', storagePath: 'logos/becker-surfboards.svg', contentType: 'image/svg+xml' },
  { slug: 'bing-surfboards', filename: 'bing-logo.png', storagePath: 'logos/bing-surfboards.png', contentType: 'image/png' },
  { slug: 'bolero-fins', filename: 'bolero-fins.png', storagePath: 'logos/bolero-fins.png', contentType: 'image/png' },
  { slug: 'campbell-brothers', filename: 'campbell-brothers.png', storagePath: 'logos/campbell-brothers.png', contentType: 'image/png' },
  { slug: 'chilli-surfboards', filename: 'chilli-logo.png', storagePath: 'logos/chilli-surfboards.png', contentType: 'image/png' },
  { slug: 'cho-shapes', filename: 'cho-shapes.png', storagePath: 'logos/cho-shapes.png', contentType: 'image/png' },
  { slug: 'churchill-fins', filename: 'churchill-fins.png', storagePath: 'logos/churchill-fins.png', contentType: 'image/png' },
  { slug: 'dafin', filename: 'dafin.png', storagePath: 'logos/dafin.png', contentType: 'image/png' },
  { slug: 'deflow-fins', filename: 'deflow-fins.png', storagePath: 'logos/deflow-fins.png', contentType: 'image/png' },
  { slug: 'dewey-weber', filename: 'dewey-weber.png', storagePath: 'logos/dewey-weber.png', contentType: 'image/png' },
  { slug: 'dhd-surfboards', filename: 'dhd-logo.png', storagePath: 'logos/dhd-surfboards.png', contentType: 'image/png' },
  { slug: 'dp-surfboards', filename: 'dp-surfboards.png', storagePath: 'logos/dp-surfboards.png', contentType: 'image/png' },
  { slug: 'emery-surfboards', filename: 'emery-surfboards.png', storagePath: 'logos/emery-surfboards.png', contentType: 'image/png' },
  { slug: 'endorfins', filename: 'endorfins.png', storagePath: 'logos/endorfins.png', contentType: 'image/png' },
  { slug: 'florence-marine-x', filename: 'florence-marine-x.png', storagePath: 'logos/florence-marine-x.png', contentType: 'image/png' },
  { slug: 'funner-surf-craft', filename: 'funner-surf-craft.png', storagePath: 'logos/funner-surf-craft.png', contentType: 'image/png' },
  { slug: 'gordon-and-smith', filename: 'gordon-and-smith.png', storagePath: 'logos/gordon-and-smith.png', contentType: 'image/png' },
  { slug: 'grindhouse', filename: 'grindhouse.png', storagePath: 'logos/grindhouse.png', contentType: 'image/png' },
  { slug: 'harbour-surfboards', filename: 'harbour-surfboards.png', storagePath: 'logos/harbour-surfboards.png', contentType: 'image/png' },
  { slug: 'hawaiian-pro-designs', filename: 'hawaiian-pro-designs.png', storagePath: 'logos/hawaiian-pro-designs.png', contentType: 'image/png' },
  { slug: 'hayden-shapes', filename: 'hayden-shapes.png', storagePath: 'logos/hayden-shapes.png', contentType: 'image/png' },
  { slug: 'infinity-surfboards', filename: 'infinity-surfboards.png', storagePath: 'logos/infinity-surfboards.png', contentType: 'image/png' },
  { slug: 'jones-surfboards', filename: 'jones-surfboards.png', storagePath: 'logos/jones-surfboards.png', contentType: 'image/png' },
  { slug: 'js-surfboards', filename: 'js-logo.jpg', storagePath: 'logos/js-surfboards.jpg', contentType: 'image/jpeg' },
  { slug: 'lib-tech-surfboards', filename: 'lib-tech-surfboards.svg', storagePath: 'logos/lib-tech-surfboards.svg', contentType: 'image/svg+xml' },
  { slug: 'local-motion-surfboards', filename: 'local-motion-surfboards.png', storagePath: 'logos/local-motion-surfboards.png', contentType: 'image/png' },
  { slug: 'lost-surfboards', filename: 'lost-logo.jpg', storagePath: 'logos/lost-surfboards.jpg', contentType: 'image/jpeg' },
  { slug: 'ryan-lovelace-surfboards', filename: 'lovelace-logo.png', storagePath: 'logos/ryan-lovelace-surfboards.png', contentType: 'image/png' },
  { slug: 'mark-richards-surfboards', filename: 'mark-richards-surfboards.png', storagePath: 'logos/mark-richards-surfboards.png', contentType: 'image/png' },
  { slug: 'maurice-cole-surfboards', filename: 'maurice-cole-surfboards.png', storagePath: 'logos/maurice-cole-surfboards.png', contentType: 'image/png' },
  { slug: 'mf-softboards', filename: 'mf-softboards.png', storagePath: 'logos/mf-softboards.png', contentType: 'image/png' },
  { slug: 'mid-fin-co', filename: 'mid-fin-co.png', storagePath: 'logos/mid-fin-co.png', contentType: 'image/png' },
  { slug: 'noll-surfboards', filename: 'noll-surfboards.png', storagePath: 'logos/noll-surfboards.png', contentType: 'image/png' },
  { slug: 'nsp-surfboards', filename: 'nsp-surfboards.webp', storagePath: 'logos/nsp-surfboards.webp', contentType: 'image/webp' },
  { slug: 'nvs-fins', filename: 'nvs-fins.png', storagePath: 'logos/nvs-fins.png', contentType: 'image/png' },
  { slug: 'ocean-and-earth', filename: 'ocean-and-earth.png', storagePath: 'logos/ocean-and-earth.png', contentType: 'image/png' },
  { slug: 'olero-surfboards', filename: 'olero-surfboards.png', storagePath: 'logos/olero-surfboards.png', contentType: 'image/png' },
  { slug: 'one-revolver-surfboards', filename: 'one-revolver-surfboards.png', storagePath: 'logos/one-revolver-surfboards.png', contentType: 'image/png' },
  { slug: 'pukas-surfboards', filename: 'pukas-surfboards.png', storagePath: 'logos/pukas-surfboards.png', contentType: 'image/png' },
  { slug: 'pyzel-surfboards', filename: 'pyzel-logo.png', storagePath: 'logos/pyzel-surfboards.png', contentType: 'image/png' },
  { slug: 'quobba-fins', filename: 'quobba-fins.png', storagePath: 'logos/quobba-fins.png', contentType: 'image/png' },
  { slug: 'ripcurl', filename: 'ripcurl.png', storagePath: 'logos/ripcurl.png', contentType: 'image/png' },
  { slug: 'roberts-surfboards', filename: 'roberts-logo.png', storagePath: 'logos/roberts-surfboards.png', contentType: 'image/png' },
  { slug: 'sharpeye-surfboards', filename: 'sharpeye-logo.png', storagePath: 'logos/sharpeye-surfboards.png', contentType: 'image/png' },
  { slug: 'simon-anderson-surfboards', filename: 'simon-anderson-surfboards.png', storagePath: 'logos/simon-anderson-surfboards.png', contentType: 'image/png' },
  { slug: 'simon-shapes', filename: 'simon-shapes.png', storagePath: 'logos/simon-shapes.png', contentType: 'image/png' },
  { slug: 'softlite-surfboards', filename: 'softlite-surfboards.png', storagePath: 'logos/softlite-surfboards.png', contentType: 'image/png' },
  { slug: 'stewart-surfboards', filename: 'stewart-surfboards.png', storagePath: 'logos/stewart-surfboards.png', contentType: 'image/png' },
  { slug: 'stretch-boards', filename: 'stretch-boards.png', storagePath: 'logos/stretch-boards.png', contentType: 'image/png' },
  { slug: 'tokoro-surfboards', filename: 'tokoro-surfboards.png', storagePath: 'logos/tokoro-surfboards.png', contentType: 'image/png' },
  { slug: 'ventana-surfboards', filename: 'ventana-surfboards.png', storagePath: 'logos/ventana-surfboards.png', contentType: 'image/png' },
  { slug: 'walden-surfboards', filename: 'walden-surfboards.png', storagePath: 'logos/walden-surfboards.png', contentType: 'image/png' },
  { slug: 'webber-surfboards', filename: 'webber-surfboards.png', storagePath: 'logos/webber-surfboards.png', contentType: 'image/png' },
]

async function uploadLogo(logo: BrandLogo): Promise<string | null> {
  const filePath = path.join(LOGO_DIR, logo.filename)
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    return null
  }

  const fileBuffer = fs.readFileSync(filePath)

  console.log(`📤 Uploading ${logo.slug} (${(fileBuffer.length / 1024).toFixed(1)}KB)...`)

  // Remove existing file if it exists
  await supabase.storage.from(BUCKET).remove([logo.storagePath])

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(logo.storagePath, fileBuffer, {
      contentType: logo.contentType,
      upsert: true,
    })

  if (error) {
    console.error(`❌ Error uploading ${logo.slug}:`, error.message)
    return null
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(logo.storagePath)
  console.log(`✅ Uploaded ${logo.slug}`)
  
  return publicUrl
}

async function updateBrandLogoUrl(slug: string, logoUrl: string): Promise<void> {
  const { error } = await supabase
    .from('brands')
    .update({ logo_url: logoUrl })
    .eq('slug', slug)

  if (error) {
    console.error(`❌ Error updating ${slug} in database:`, error.message)
  } else {
    console.log(`✅ Updated ${slug} logo_url in database`)
  }
}

async function main() {
  console.log('🚀 Starting brand logo upload...\n')

  for (const logo of brandLogos) {
    const publicUrl = await uploadLogo(logo)
    
    if (publicUrl) {
      await updateBrandLogoUrl(logo.slug, publicUrl)
    }
    
    console.log('') // blank line
  }

  console.log('✨ Done!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
