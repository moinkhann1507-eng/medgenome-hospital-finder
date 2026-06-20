// Import 30,273 hospitals from SQLite to PostgreSQL (Supabase)
// Run: node scripts/import-to-pg.js

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

async function main() {
  // Read the cleaned hospital data
  const dataPath = path.join(__dirname, '..', 'download', 'hospitals_cleaned.json')
  
  if (!fs.existsSync(dataPath)) {
    console.error('Error: hospitals_cleaned.json not found in /download/')
    console.log('Looking for:', dataPath)
    process.exit(1)
  }

  console.log('Loading hospital data...')
  const hospitals = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  console.log(`Loaded ${hospitals.length} hospitals`)

  const db = new PrismaClient()

  console.log('Checking existing data...')
  const existing = await db.hospital.count()
  if (existing > 0) {
    console.log(`Database already has ${existing} hospitals. Skipping import.`)
    console.log('Run "npx prisma db push --force-reset" first if you want to re-import.')
    await db.$disconnect()
    return
  }

  console.log('Importing hospitals to PostgreSQL...')
  const BATCH_SIZE = 500
  let imported = 0

  for (let i = 0; i < hospitals.length; i += BATCH_SIZE) {
    const batch = hospitals.slice(i, i + BATCH_SIZE)
    
    await db.$transaction(
      batch.map(h => db.hospital.create({
        data: {
          id: h.id,
          name: h.name || '',
          address: h.address || '',
          city: h.city || '',
          state: h.state || '',
          district: h.district || '',
          pincode: h.pincode || '',
          lat: h.lat || null,
          lng: h.lng || null,
          category: typeof h.category === 'object' ? JSON.stringify(h.category) : (h.category || '["general"]'),
          careType: h.careType || '',
          discipline: h.discipline || '',
          ownership: h.ownership || 'Unknown',
          beds: String(h.beds || 0),
          emergency: h.emergency || false,
          phones: typeof h.phones === 'object' ? JSON.stringify(h.phones) : (h.phones || '[]'),
          specialties: h.specialties || '',
          facilities: h.facilities || '',
        }
      }))
    )

    imported += batch.length
    const pct = ((imported / hospitals.length) * 100).toFixed(1)
    process.stdout.write(`\r  Progress: ${imported}/${hospitals.length} (${pct}%)`)
  }

  console.log(`\n✅ Successfully imported ${imported} hospitals!`)
  
  // Verify
  const total = await db.hospital.count()
  console.log(`Database now has ${total} hospitals`)
  
  await db.$disconnect()
}

main().catch(e => {
  console.error('Import failed:', e)
  process.exit(1)
})
