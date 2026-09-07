/**
 * Generate the brandLogos array for upload-brand-logos.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Next_Public_Supabase_Url
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.Supabase_Service_Role_Key

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const LOGO_DIR = path.join(process.cwd(), 'public', 'brand-logos')

async function main() {
  const { data: brands } = await supabase
    .from('brands')
    .select('slug, name')
    .order('slug')
  
  const files = fs.readdirSync(LOGO_DIR).filter(f => f.match(/\.(png|jpg|svg|webp)$/))
  
  const mappings: any[] = []
  
  for (const file of files) {
    const slugGuess = file
      .replace(/\..*$/, '')
      .replace(/-logo$/, '')
    
    const brand = brands?.find(b => 
      b.slug === slugGuess || 
      file.startsWith(b.slug) ||
      b.slug.includes(slugGuess)
    )
    
    if (brand) {
      const ext = file.split('.').pop()
      const contentType = 
        ext === 'svg' ? 'image/svg+xml' :
        ext === 'webp' ? 'image/webp' :
        ext === 'jpg' ? 'image/jpeg' :
        'image/png'
      
      mappings.push({
        slug: brand.slug,
        filename: file,
        storagePath: `logos/${brand.slug}.${ext}`,
        contentType
      })
    } else {
      console.log(`⚠️  No brand found for: ${file}`)
    }
  }
  
  console.log('const brandLogos: BrandLogo[] = [')
  mappings.forEach(m => {
    console.log(`  { slug: '${m.slug}', filename: '${m.filename}', storagePath: '${m.storagePath}', contentType: '${m.contentType}' },`)
  })
  console.log(']')
}

main()
