import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const q = searchParams.get('q') || ''

  try {
    // Get all hospitals with specialties data
    const hospitals = await db.hospital.findMany({
      select: { specialties: true },
      where: q ? { specialties: { contains: q } } : {},
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

    const specialties = Array.from(specMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ specialties, total: specialties.length })
  } catch (error) {
    console.error('Specialties API error:', error)
    return NextResponse.json({ error: 'Failed to fetch specialties' }, { status: 500 })
  }
}
