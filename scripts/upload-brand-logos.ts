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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
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
}

const brandLogos: BrandLogo[] = [
  { slug: 'bing-surfboards', filename: 'bing-logo.png', storagePath: 'logos/bing-surfboards.png' },
  { slug: 'chilli-surfboards', filename: 'chilli-logo.png', storagePath: 'logos/chilli-surfboards.png' },
  { slug: 'dhd-surfboards', filename: 'dhd-logo.png', storagePath: 'logos/dhd-surfboards.png' },
  { slug: 'hayden-shapes', filename: 'haydenshapes-logo.png', storagePath: 'logos/hayden-shapes.png' },
  { slug: 'lost-surfboards', filename: 'lost-logo.jpg', storagePath: 'logos/lost-surfboards.jpg' },
  { slug: 'lovelace-machine', filename: 'lovelace-logo.png', storagePath: 'logos/lovelace-machine.png' },
  { slug: 'pyzel-surfboards', filename: 'pyzel-logo.png', storagePath: 'logos/pyzel-surfboards.png' },
  { slug: 'roberts-surfboards', filename: 'roberts-logo.png', storagePath: 'logos/roberts-surfboards.png' },
  { slug: 'sharpeye-surfboards', filename: 'sharpeye-logo.png', storagePath: 'logos/sharpeye-surfboards.png' },
]

async function uploadLogo(logo: BrandLogo): Promise<string | null> {
  const filePath = path.join(LOGO_DIR, logo.filename)
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    return null
  }

  const fileBuffer = fs.readFileSync(filePath)
  const contentType = logo.filename.endsWith('.jpg') ? 'image/jpeg' : 'image/png'

  console.log(`📤 Uploading ${logo.slug}...`)

  // Remove existing file if it exists
  await supabase.storage.from(BUCKET).remove([logo.storagePath])

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(logo.storagePath, fileBuffer, {
      contentType,
      upsert: true,
    })

  if (error) {
    console.error(`❌ Error uploading ${logo.slug}:`, error.message)
    return null
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(logo.storagePath)
  console.log(`✅ Uploaded ${logo.slug}: ${publicUrl}`)
  
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
