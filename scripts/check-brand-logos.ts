/**
 * Query all brands and check which ones are missing logos
 * Run with: npx tsx scripts/check-brand-logos.ts
 */

import { createClient } from '@supabase/supabase-js'

// Support both standard and Cursor Cloud Agent env var naming
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Next_Public_Supabase_Url
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.Supabase_Service_Role_Key

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function checkBrandLogos() {
  console.log('🔍 Checking all brands for missing logos...\n')

  const { data: brands, error } = await supabase
    .from('brands')
    .select('slug, name, logo_url')
    .order('name')

  if (error) {
    console.error('❌ Error fetching brands:', error.message)
    process.exit(1)
  }

  if (!brands) {
    console.log('No brands found')
    return
  }

  console.log(`Found ${brands.length} total brands\n`)

  const missingLogos = brands.filter(b => !b.logo_url || b.logo_url.trim() === '')
  const hasLogos = brands.filter(b => b.logo_url && b.logo_url.trim() !== '')
  const hasSupabaseLogos = brands.filter(b => 
    b.logo_url && b.logo_url.includes('app.reswell.app/storage')
  )

  console.log('📊 Statistics:')
  console.log(`  ✅ Has logos: ${hasLogos.length}`)
  console.log(`  📦 In Supabase: ${hasSupabaseLogos.length}`)
  console.log(`  ❌ Missing logos: ${missingLogos.length}\n`)

  if (missingLogos.length > 0) {
    console.log('❌ Brands missing logos:')
    missingLogos.forEach(b => {
      console.log(`  - ${b.name} (${b.slug})`)
    })
    console.log('')
  }

  const externalLogos = hasLogos.filter(b => 
    !b.logo_url.includes('app.reswell.app/storage')
  )
  
  if (externalLogos.length > 0) {
    console.log('🔗 Brands with external URLs:')
    externalLogos.forEach(b => {
      console.log(`  - ${b.name}: ${b.logo_url}`)
    })
  }
}

checkBrandLogos().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
