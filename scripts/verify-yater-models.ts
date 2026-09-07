/**
 * Verify Yater Surfboards models in database
 * 
 * Run with: npx tsx scripts/verify-yater-models.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Next_Public_Supabase_Url
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.Supabase_Service_Role_Key

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('🔍 Verifying Yater Surfboards models...\n')
  
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('slug', 'yater-surfboards')
    .single()
  
  if (!brand) {
    console.error('❌ Brand not found')
    process.exit(1)
  }
  
  const { data: models, error } = await supabase
    .from('brand_models')
    .select('*')
    .eq('brand_id', brand.id)
    .order('name')
  
  if (error) {
    console.error('❌ Error fetching models:', error.message)
    process.exit(1)
  }
  
  console.log(`Brand: ${brand.name}\n`)
  console.log(`Found ${models?.length || 0} models:\n`)
  
  models?.forEach((model, i) => {
    console.log(`${i + 1}. ${model.name}`)
    console.log(`   ${model.description}`)
    if (model.image_url) {
      console.log(`   🖼️  Image: ${model.image_url}`)
    } else {
      console.log(`   ❌ No image`)
    }
    console.log('')
  })
}

main().catch(console.error)
