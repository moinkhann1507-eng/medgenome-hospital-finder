import { NextRequest, NextResponse } from 'next/server'

// MedGenome AI — Tries standalone AI server first (port 3001), falls back to embedded Z-AI

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query } = body as { query: string }

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Try standalone AI server first (more stable)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)
      
      const res = await fetch('http://127.0.0.1:3001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        return NextResponse.json(data)
      }
    } catch {
      // Standalone server not available, use embedded fallback
    }

    // Embedded fallback: DB search + Z-AI
    const terms = query.slice(0, 100).split(/\s+/).filter(t => t.length > 1)
    const orConditions: Record<string, unknown>[] = [
      { name: { contains: query } },
      { city: { contains: query } },
      { state: { contains: query } },
      { specialties: { contains: query } },
      { category: { contains: query } },
      { discipline: { contains: query } },
    ]
    for (const term of terms) {
      orConditions.push(
        { name: { contains: term } },
        { city: { contains: term } },
        { state: { contains: term } },
        { specialties: { contains: term } },
        { category: { contains: term } },
      )
    }
    const hospitals = await db.hospital.findMany({
      where: { OR: orConditions },
      take: 15,
      orderBy: { id: 'asc' },
    })

    const hospitalSummaries = hospitals.map(h => ({
      name: h.name, city: h.city, state: h.state,
      category: JSON.parse((h.category as string) || '["general"]'),
      ownership: h.ownership, beds: parseInt(h.beds as string) || 0,
      emergency: h.emergency,
      specialties: (h.specialties as string)?.slice(0, 120) || '',
    }))

    const parsedHospitals = hospitals.map(h => ({
      ...h,
      category: JSON.parse((h.category as string) || '["general"]'),
      phones: JSON.parse((h.phones as string) || '[]'),
      beds: parseInt(h.beds as string) || 0,
    }))

    let aiResponse = ''
    let source = 'local'
    let hasWebResults = false

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      let webContext = ''
      try {
        const webResult = await withTimeout(
          zai.functions.invoke('web_search', { query: `hospitals India ${query}` }),
          5000, []
        ) as Array<{ name?: string; title?: string; snippet?: string }>
        if (Array.isArray(webResult) && webResult.length > 0) {
          webContext = webResult.slice(0, 3).map(r => `${r.name || r.title}: ${r.snippet || ''}`).join('\n')
          hasWebResults = true
        }
      } catch {}

      const dirList = hospitalSummaries.length > 0
        ? hospitalSummaries.map(h => `${h.name} (${h.city}, ${h.state}) [${h.category.join('/')}] ${h.ownership} ${h.emergency ? 'ER' : ''}`).join('\n')
        : 'No matches in directory'

      const completion = await withTimeout(
        zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are MedGenome AI, hospital finder for India (30K+ hospitals). Be concise. Bold names **name**. Respond in user language. If web results, mention separately.' },
            { role: 'user', content: `Query: "${query}"\nDirectory:\n${dirList}\n${webContext ? `Web:\n${webContext}` : ''}\nRecommend.` },
          ],
          thinking: { type: 'disabled' },
        }),
        10000, null
      ) as { choices?: Array<{ message?: { content?: string } }> } | null

      if (completion?.choices?.[0]?.message?.content) {
        aiResponse = completion.choices[0].message.content
        source = 'z-ai'
      }
    } catch (e) {
      console.log('Z-AI fallback error:', e instanceof Error ? e.message : String(e))
    }

    if (!aiResponse) {
      aiResponse = generateLocalResponse(query, hospitalSummaries)
    }

    return NextResponse.json({
      response: aiResponse,
      hospitals: parsedHospitals,
      source,
      webResults: hasWebResults ? 'found' : undefined,
    })
  } catch (error) {
    console.error('AI route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Import db lazily for the embedded fallback path
import { db } from '@/lib/db'

function generateLocalResponse(query: string, hospitals: Array<Record<string, unknown>>): string {
  const count = hospitals.length
  if (count === 0) return `I couldn't find hospitals matching "${query}" in our database of 30,000+ hospitals. Try a city name, state, or specialty.`
  const top = hospitals.slice(0, 5)
  const names = top.map(h => `**${h.name}** (${h.city}, ${h.state})`).join(', ')
  let response = `Found ${count} hospitals. Top recommendations: ${names}.`
  const q = query.toLowerCase()
  if (q.includes('emergency') || q.includes('urgent')) {
    const em = hospitals.filter(h => h.emergency)
    if (em.length > 0) response += ` ${em.length} have 24/7 emergency services.`
  }
  if (q.includes('government') || q.includes('govt') || q.includes('public')) {
    const gov = hospitals.filter(h => h.ownership === 'Government')
    if (gov.length > 0) response += ` ${gov.length} government hospitals found.`
  }
  return response
}
