/**
 * Add Yater Surfboards models to database
 * 
 * Run with: npx tsx scripts/add-yater-models.ts
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

const YATER_MODELS = [
  {
    name: 'SPOON',
    description: 'Classic longboard design. Clear tints. Available 8\'6" to 10\'.'
  },
  {
    name: 'BABY SPOON',
    description: 'Smaller version of the classic Spoon longboard. Clear tints. Available 7\'6" to 8\'.'
  },
  {
    name: 'Classic SPOON',
    description: 'Full dress, classic look longboard. Wood fin. Clear tints. Available in 9\', 9\'3", 9\'6", and 9\'10".'
  },
  {
    name: 'HP LONGBOARD',
    description: 'High performance longboard with contemporary down rail shape. Fast, quick turning. Available in single, 2+1, or twin fin setup. Lengths 8\'6" to 10\'.'
  },
  {
    name: 'HP SPEED LONGBOARD',
    description: 'High performance speed longboard with contemporary down rail shape. Steep down-the-line design. Available in single, 2+1, or twin fin setup. Lengths 8\'6" to 9\'6".'
  },
  {
    name: 'FUN SHAPE',
    description: 'Full plan shape, easy rider. Available in tri-fin or twin-fin setup. Lengths 7\'4" to 8\'.'
  },
  {
    name: 'SHORT BOARD',
    description: 'Wider and thicker shortboard design. Available in tri-fin or twin-fin setup. Medium range 7\' to 7\'6".'
  },
]

async function main() {
  console.log('🚀 Adding Yater Surfboards models...\n')
  
  // Get Yater Surfboards brand ID
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('slug', 'yater-surfboards')
    .single()
  
  if (brandError || !brand) {
    console.error('❌ Yater Surfboards brand not found in database')
    console.error(brandError)
    process.exit(1)
  }
  
  console.log(`✅ Found brand: ${brand.name} (${brand.id})\n`)
  
  let added = 0
  let skipped = 0
  
  for (const model of YATER_MODELS) {
    // Check if model already exists
    const { data: existing } = await supabase
      .from('brand_models')
      .select('id, name')
      .eq('brand_id', brand.id)
      .ilike('name', model.name)
      .single()
    
    if (existing) {
      console.log(`⏭️  ${model.name} - already exists`)
      skipped++
      continue
    }
    
    // Insert the model
    const { error } = await supabase
      .from('brand_models')
      .insert({
        brand_id: brand.id,
        name: model.name,
        description: model.description
      })
    
    if (error) {
      console.error(`❌ Error adding ${model.name}:`, error.message)
    } else {
      console.log(`✅ Added ${model.name}`)
      added++
    }
  }
  
  console.log(`\n📊 Results:`)
  console.log(`  ✅ Added: ${added}`)
  console.log(`  ⏭️  Skipped (already exists): ${skipped}`)
  console.log(`\n✨ Done!`)
}

main().catch(console.error)
