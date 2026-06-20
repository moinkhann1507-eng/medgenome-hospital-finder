import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [statesResult, categoriesResult, ownershipResult, totalResult, withCoordsResult, emergencyResult] = await Promise.all([
      db.hospital.findMany({
        select: { state: true },
        distinct: ['state'],
        orderBy: { state: 'asc' },
      }),
      db.hospital.findMany({
        select: { category: true },
      }),
      db.hospital.findMany({
        select: { ownership: true },
        distinct: ['ownership'],
      }),
      db.hospital.count(),
      db.hospital.count({
        where: { NOT: [{ lat: null }, { lng: null }] },
      }),
      db.hospital.count({
        where: { emergency: true },
      }),
    ])

    const categorySet = new Set<string>()
    categoriesResult.forEach(h => {
      try {
        const cats = JSON.parse(h.category as string || '["general"]')
        cats.forEach((c: string) => categorySet.add(c))
      } catch {
        categorySet.add('general')
      }
    })

    return NextResponse.json({
      total: totalResult,
      withCoords: withCoordsResult,
      withEmergency: emergencyResult,
      states: statesResult.map(s => s.state).filter(Boolean),
      categories: Array.from(categorySet).sort(),
      ownershipTypes: ownershipResult.map(o => o.ownership).filter(Boolean),
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
