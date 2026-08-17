/**
 * Upload Yater model images to Supabase and update brand_models
 * 
 * Run with: npx tsx scripts/upload-yater-model-images.ts
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

const IMAGES_DIR = path.join(process.cwd(), 'public', 'yater-models')
const BUCKET = 'brand-assets'

type ModelImage = {
  modelName: string
  filename: string
  storagePath: string
}

const MODEL_IMAGES: ModelImage[] = [
  { modelName: 'SPOON', filename: 'spoon.jpg', storagePath: 'board-models/yater-spoon.jpg' },
  { modelName: 'BABY SPOON', filename: 'baby-spoon.jpg', storagePath: 'board-models/yater-baby-spoon.jpg' },
  { modelName: 'Classic SPOON', filename: 'classic-spoon.jpg', storagePath: 'board-models/yater-classic-spoon.jpg' },
  { modelName: 'HP LONGBOARD', filename: 'hp-longboard.jpg', storagePath: 'board-models/yater-hp-longboard.jpg' },
  { modelName: 'HP SPEED LONGBOARD', filename: 'hp-speed-longboard.jpg', storagePath: 'board-models/yater-hp-speed-longboard.jpg' },
  { modelName: 'FUN SHAPE', filename: 'fun-shape.jpg', storagePath: 'board-models/yater-fun-shape.jpg' },
  { modelName: 'SHORT BOARD', filename: 'short-board.jpg', storagePath: 'board-models/yater-short-board.jpg' },
]

async function main() {
  console.log('🚀 Uploading Yater model images...\n')
  
  // Get Yater brand
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('slug', 'yater-surfboards')
    .single()
  
  if (!brand) {
    console.error('❌ Yater Surfboards brand not found')
    process.exit(1)
  }
  
  console.log(`✅ Found brand: ${brand.name}\n`)
  
  let uploaded = 0
  let updated = 0
  
  for (const modelImage of MODEL_IMAGES) {
    const filePath = path.join(IMAGES_DIR, modelImage.filename)
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`)
      continue
    }
    
    const fileBuffer = fs.readFileSync(filePath)
    const fileSizeKB = (fileBuffer.length / 1024).toFixed(1)
    
    console.log(`📤 Uploading ${modelImage.modelName} (${fileSizeKB}KB)...`)
    
    // Remove existing file if it exists
    await supabase.storage.from(BUCKET).remove([modelImage.storagePath])
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(modelImage.storagePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })
    
    if (uploadError) {
      console.error(`❌ Error uploading ${modelImage.modelName}:`, uploadError.message)
      continue
    }
    
    uploaded++
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(modelImage.storagePath)
    
    console.log(`✅ Uploaded to storage`)
    
    // Update brand_model with image_url
    const { data: model, error: selectError } = await supabase
      .from('brand_models')
      .select('id')
      .eq('brand_id', brand.id)
      .ilike('name', modelImage.modelName)
      .single()
    
    if (selectError || !model) {
      console.error(`❌ Model "${modelImage.modelName}" not found in database`)
      continue
    }
    
    const { error: updateError } = await supabase
      .from('brand_models')
      .update({ image_url: publicUrl })
      .eq('id', model.id)
    
    if (updateError) {
      console.error(`❌ Error updating model:`, updateError.message)
    } else {
      console.log(`✅ Updated model with image URL`)
      updated++
    }
    
    console.log('')
  }
  
  console.log(`📊 Results:`)
  console.log(`  ✅ Uploaded to storage: ${uploaded}`)
  console.log(`  ✅ Updated models: ${updated}`)
  console.log(`\n✨ Done!`)
}

main().catch(console.error)
