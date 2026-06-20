import { NextResponse } from 'next/server'

export async function GET() {
  const results: Record<string, string> = {}
  
  // Check current DATABASE_URL (hide password)
  const dbUrl = process.env.DATABASE_URL || 'NOT SET'
  results.current_url = dbUrl.replace(/:([^@]+)@/, ':****@')
  
  // Try all connection variants
  const connections = [
    { name: 'direct_5432', host: 'db.qrfikgmsydgashofhble.supabase.co', port: 5432, user: 'postgres' },
    { name: 'pooler_se2_6543', host: 'aws-0-ap-southeast-2.pooler.supabase.com', port: 6543, user: 'postgres.qrfikgmsydgashofhble' },
    { name: 'pooler_s1_6543', host: 'aws-0-ap-south-1.pooler.supabase.com', port: 6543, user: 'postgres.qrfikgmsydgashofhble' },
    { name: 'pooler_se1_6543', host: 'aws-0-ap-southeast-1.pooler.supabase.com', port: 6543, user: 'postgres.qrfikgmsydgashofhble' },
    { name: 'pooler_se2_session', host: 'aws-0-ap-southeast-2.pooler.supabase.com', port: 5432, user: 'postgres.qrfikgmsydgashofhble' },
  ]
  
  for (const conn of connections) {
    try {
      const pg = await import('pg')
      const client = new pg.Client({
        host: conn.host,
        port: conn.port,
        database: 'postgres',
        user: conn.user,
        password: 'Moin8147156',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      })
      await client.connect()
      const res = await client.query('SELECT current_database()')
      results[conn.name] = 'SUCCESS - DB: ' + res.rows[0].current_database
      await client.end()
    } catch(e: unknown) {
      results[conn.name] = 'FAILED: ' + (e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120))
    }
  }

  return NextResponse.json(results, { status: 200 })
}
