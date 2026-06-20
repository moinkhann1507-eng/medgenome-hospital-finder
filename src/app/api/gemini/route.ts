import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface HospitalRow {
  id: number
  name: string
  city: string
  state: string
  district: string
  category: string
  careType: string
  discipline: string
  ownership: string
  beds: string
  emergency: boolean
  phones: string
  specialties: string
  facilities: string
  lat: number | null
  lng: number | null
  address: string
  pincode: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query } = body as { query: string }

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Fetch relevant hospitals from DB for context - broader search
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
      take: 30,
      orderBy: { id: 'asc' },
    })

    const hospitalContext = hospitals.map(h => {
      const cats = JSON.parse((h.category as string) || '["general"]')
      return {
        name: h.name,
        city: h.city,
        state: h.state,
        district: h.district,
        category: cats,
        ownership: h.ownership,
        beds: parseInt(h.beds as string) || 0,
        emergency: h.emergency,
        specialties: h.specialties?.slice(0, 300),
        lat: h.lat,
        lng: h.lng,
      }
    })

    const parsedHospitals = hospitals.map(h => ({
      ...h,
      category: JSON.parse((h.category as string) || '["general"]'),
      phones: JSON.parse((h.phones as string) || '[]'),
      beds: parseInt(h.beds as string) || 0,
    }))

    // Try web search for additional hospital information
    let webResults = ''
    let hasWebResults = false
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      
      // Use web search to find hospitals not in our directory
      const webSearchResult = await zai.functions.invoke('web_search', {
        query: `hospitals in India ${query}`,
      })
      
      if (Array.isArray(webSearchResult) && webSearchResult.length > 0) {
        webResults = webSearchResult
          .slice(0, 5)
          .map((r: { name?: string; title?: string; snippet?: string; url?: string }) => `${r.name || r.title}: ${r.snippet}`)
          .join('\n')
        hasWebResults = true
      }
    } catch (e) {
      console.log('Web search not available or failed:', e instanceof Error ? e.message : String(e))
    }

    // Use z-ai-web-dev-sdk for AI chat
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      const systemPrompt = `You are MedGenome AI, an expert assistant for finding hospitals across India. You have access to a database of 30,000+ hospitals across all 36 states and union territories, plus web search results.

Given a user query, hospital data from our directory, and web search results, provide helpful recommendations. Important guidelines:
- Recommend hospitals from the provided directory data when possible
- If the user asks about hospitals NOT in our directory, use the web search results to provide additional information
- Clearly indicate which hospitals are from our directory vs. found on the web
- If exact match not found, suggest the closest alternatives  
- Mention if hospitals have emergency services when relevant
- Consider ownership (Government/Private) when user mentions budget
- We have 2,576+ specialties including: Cardiology, Neurology, Orthopedics, Oncology, Pediatrics, Nephrology, Urology, Dermatology, Gastroenterology, Pulmonology, Endocrinology, Rheumatology, Ophthalmology, ENT, Psychiatry, Obstetrics & Gynecology, General Surgery, Plastic Surgery, Cardiothoracic Surgery, Neurosurgery, and many more
- Be helpful, concise, and practical
- Respond in the same language the user uses (Hindi/English/etc)
- Format hospital names in bold using **name**
- When showing hospital results, include city and state`

      const userPrompt = `User Query: "${query}"

Available Hospital Data from Directory (top matches from database of 30,273 hospitals):
${hospitalContext.length > 0 ? JSON.stringify(hospitalContext, null, 2) : 'No matches found in directory'}

${webResults ? `Web Search Results (hospitals that may NOT be in our directory):
${webResults}` : 'No web search results available.'}

Provide practical hospital recommendations. If you found results from the web that are not in our directory, mention them separately as "Also found on the web" to help the user discover additional options.`

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userPrompt },
        ],
        thinking: { type: 'disabled' },
      })

      const aiText = completion.choices?.[0]?.message?.content || generateLocalResponse(query, hospitalContext)

      return NextResponse.json({
        response: aiText,
        hospitals: parsedHospitals,
        source: 'z-ai',
        webResults: hasWebResults ? 'found' : undefined,
      })
    } catch (aiError) {
      console.error('Z-AI SDK error, falling back to local:', aiError instanceof Error ? aiError.message : String(aiError))
      return NextResponse.json({
        response: generateLocalResponse(query, hospitalContext),
        hospitals: parsedHospitals,
        source: 'local',
      })
    }
  } catch (error) {
    console.error('AI route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateLocalResponse(query: string, hospitals: Array<Record<string, unknown>>): string {
  const q = query.toLowerCase()
  const count = hospitals.length

  if (count === 0) {
    return `I couldn't find hospitals matching "${query}" in our database of 30,000+ hospitals across India. Try searching with a city name, state, or specialty (e.g., "cardiac hospitals in Mumbai").`
  }

  const top = hospitals.slice(0, 5)
  const names = top.map(h => `**${h.name}** (${h.city}, ${h.state})`).join(', ')
  let response = `Found ${count} hospitals matching your query. Top recommendations: ${names}.`

  if (q.includes('emergency') || q.includes('urgent')) {
    const emHospitals = hospitals.filter(h => h.emergency)
    if (emHospitals.length > 0) response += ` ${emHospitals.length} of these have 24/7 emergency services.`
  }

  if (q.includes('government') || q.includes('govt') || q.includes('public')) {
    const govHospitals = hospitals.filter(h => h.ownership === 'Government')
    if (govHospitals.length > 0) response += ` ${govHospitals.length} government hospitals found.`
  }

  if (q.includes('private') || q.includes('corporate')) {
    const pvtHospitals = hospitals.filter(h => h.ownership === 'Private')
    if (pvtHospitals.length > 0) response += ` ${pvtHospitals.length} private hospitals found.`
  }

  return response
}
