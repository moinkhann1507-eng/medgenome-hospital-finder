import { NextResponse } from 'next/server'

// Cache specialties to avoid re-computing on every request
let cachedSpecialties: { name: string; count: number }[] | null = null
let cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function GET() {
  try {
    // Return cached result if available
    if (cachedSpecialties && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json({ specialties: cachedSpecialties, total: cachedSpecialties.length })
    }

    // Import db lazily
    const { db } = await import('@/lib/db')

    // Get all hospitals with specialties data - only non-empty specialties
    const hospitals = await db.hospital.findMany({
      select: { specialties: true },
      where: { 
        NOT: [
          { specialties: '' },
          { specialties: '0' },
        ]
      },
    })

    const specMap = new Map<string, number>()
    hospitals.forEach(h => {
      const s = h.specialties as string
      if (!s || s === '0' || s === '') return
      
      // Split by common delimiters
      const parts = s.split(/[,;|/\n]+/)
      parts.forEach(part => {
        const spec = part.trim()
        if (spec && spec.length > 2 && spec.length < 80) {
          specMap.set(spec, (specMap.get(spec) || 0) + 1)
        }
      })
    })

    cachedSpecialties = Array.from(specMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    cacheTime = Date.now()

    return NextResponse.json({ specialties: cachedSpecialties, total: cachedSpecialties.length })
  } catch (error) {
    console.error('Specialties API error:', error)
    return NextResponse.json({ error: 'Failed to fetch specialties' }, { status: 500 })
  }
}
