import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const state = searchParams.get('state') || ''
  const category = searchParams.get('category') || ''
  const ownership = searchParams.get('ownership') || ''
  const hasCoords = searchParams.get('hasCoords') === 'true'
  const emergency = searchParams.get('emergency') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const where: Record<string, unknown> = {}

    if (query) {
      const terms = query.split(/\s+/).filter(t => t.length > 1)
      const orConditions: Record<string, unknown>[] = [
        { name: { contains: query } },
        { city: { contains: query } },
        { state: { contains: query } },
        { district: { contains: query } },
        { specialties: { contains: query } },
        { address: { contains: query } },
        { category: { contains: query } },
        { discipline: { contains: query } },
        { careType: { contains: query } },
      ]
      // Also search individual terms for broader matches
      if (terms.length > 1) {
        for (const term of terms) {
          orConditions.push(
            { name: { contains: term } },
            { city: { contains: term } },
            { state: { contains: term } },
            { specialties: { contains: term } },
            { category: { contains: term } },
          )
        }
      }
      where.OR = orConditions
    }

    if (state) {
      where.state = { contains: state }
    }

    if (category) {
      where.category = { contains: category }
    }

    if (ownership && ownership !== 'all') {
      where.ownership = ownership
    }

    if (hasCoords) {
      where.NOT = [{ lat: null }, { lng: null }]
    }

    if (emergency) {
      where.emergency = true
    }

    const [hospitals, total] = await Promise.all([
      db.hospital.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { id: 'asc' },
      }),
      db.hospital.count({ where }),
    ])

    // Parse JSON fields for response
    const result = hospitals.map(h => ({
      ...h,
      category: JSON.parse(h.category as string || '["general"]'),
      phones: JSON.parse(h.phones as string || '[]'),
      beds: parseInt(h.beds as string) || 0,
    }))

    return NextResponse.json({ hospitals: result, total })
  } catch (error) {
    console.error('Hospitals API error:', error)
    return NextResponse.json({ error: 'Failed to fetch hospitals' }, { status: 500 })
  }
}
