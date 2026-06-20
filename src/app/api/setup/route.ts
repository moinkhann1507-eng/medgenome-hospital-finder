import { NextRequest, NextResponse } from 'next/server'

// Setup: Step 1 - Create the database schema
// Visit /api/setup to initialize

export async function GET(request: NextRequest) {
  try {
    const { db } = await import('@/lib/db')
    
    // Test connection
    const count = await db.hospital.count()
    
    if (count > 0) {
      return NextResponse.json({ 
        status: 'ready', 
        message: `Database is ready with ${count} hospitals!`,
        hospitals: count 
      })
    }

    return NextResponse.json({ 
      status: 'empty', 
      message: 'Database connected but empty. Run: npx prisma db push && node scripts/import-to-pg.js from your local machine with DATABASE_URL set to your Supabase URL.',
      hint: 'Set DATABASE_URL environment variable, then run the import script locally.'
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      status: 'error',
      message: msg,
      hint: 'Make sure DATABASE_URL is set in Vercel Environment Variables and points to your Supabase PostgreSQL database.'
    }, { status: 500 })
  }
}
