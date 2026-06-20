import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>
    }
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, context } = body as { query: string; context?: string }

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Fetch relevant hospitals from DB for context - broader search
    const searchTerm = query.slice(0, 100)
    const terms = searchTerm.split(/\s+/).filter(t => t.length > 1)
    const orConditions: Record<string, unknown>[] = [
      { name: { contains: searchTerm } },
      { city: { contains: searchTerm } },
      { state: { contains: searchTerm } },
      { specialties: { contains: searchTerm } },
      { category: { contains: searchTerm } },
      { discipline: { contains: searchTerm } },
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
        specialties: h.specialties?.slice(0, 200),
        lat: h.lat,
        lng: h.lng,
      }
    })

    // If no Gemini API key, use smart keyword-based search as fallback
    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        response: generateLocalResponse(query, hospitalContext),
        hospitals: hospitals.map(h => ({
          ...h,
          category: JSON.parse((h.category as string) || '["general"]'),
          phones: JSON.parse((h.phones as string) || '[]'),
          beds: parseInt(h.beds as string) || 0,
        })),
        source: 'local',
      })
    }

    // Use Gemini AI
    const systemPrompt = `You are MedGenome Hospital Finder AI, an expert assistant for finding hospitals across India. You have access to a database of 30,000+ hospitals across all 36 states and union territories.

Given a user query and hospital data, provide helpful recommendations. Always respond in a structured format:

1. A brief natural language response answering the user's query
2. Key hospital recommendations with reasons

Important guidelines:
- Recommend hospitals from the provided data when possible
- If exact match not found, suggest the closest alternatives
- Mention if hospitals have emergency services when relevant
- Consider ownership (Government/Private) when user mentions budget
- Categories include: general, cardiac, pediatric, orthopedic, neuro, oncology, trauma, maternity, eye, dental, ent, ayurveda, mental, transplant, rehab, diagnostic, phc, clinic
- Be helpful and concise
- Always respond in the same language the user uses (Hindi/English/etc)`

    const userPrompt = `User Query: "${query}"

Available Hospital Data (top matches from database):
${JSON.stringify(hospitalContext, null, 2)}

${context ? `Additional context: ${context}` : ''}

Please analyze and provide recommendations. Format your response as natural text with hospital names in bold.`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'I understand. I am MedGenome Hospital Finder AI, ready to help find hospitals across India based on user queries. I will provide structured, helpful recommendations from the available data.' }] },
            { role: 'user', parts: [{ text: userPrompt }] },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      return NextResponse.json({
        response: generateLocalResponse(query, hospitalContext),
        hospitals: hospitals.map(h => ({
          ...h,
          category: JSON.parse((h.category as string) || '["general"]'),
          phones: JSON.parse((h.phones as string) || '[]'),
          beds: parseInt(h.beds as string) || 0,
        })),
        source: 'local-fallback',
      })
    }

    const data = (await geminiResponse.json()) as GeminiResponse
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || generateLocalResponse(query, hospitalContext)

    return NextResponse.json({
      response: aiText,
      hospitals: hospitals.map(h => ({
        ...h,
        category: JSON.parse((h.category as string) || '["general"]'),
        phones: JSON.parse((h.phones as string) || '[]'),
        beds: parseInt(h.beds as string) || 0,
      })),
      source: 'gemini',
    })
  } catch (error) {
    console.error('Gemini API route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateLocalResponse(query: string, hospitals: Array<Record<string, unknown>>): string {
  const q = query.toLowerCase()
  const count = hospitals.length

  if (count === 0) {
    return `I couldn't find any hospitals matching "${query}" in our database of 30,000+ hospitals across India. Try searching with different keywords like a city name, state, or specialty (e.g., "cardiac hospitals in Mumbai").`
  }

  const topHospitals = hospitals.slice(0, 5)
  const names = topHospitals.map(h => `**${h.name}** (${h.city}, ${h.state})`).join(', ')

  let response = `Found ${count} hospitals matching your query. Top recommendations: ${names}.`

  if (q.includes('emergency') || q.includes('urgent')) {
    const emHospitals = hospitals.filter(h => h.emergency)
    if (emHospitals.length > 0) {
      response += ` ${emHospitals.length} of these have 24/7 emergency services.`
    }
  }

  if (q.includes('government') || q.includes('govt') || q.includes('public')) {
    const govHospitals = hospitals.filter(h => h.ownership === 'Government')
    if (govHospitals.length > 0) {
      response += ` ${govHospitals.length} government hospitals found in results.`
    }
  }

  if (q.includes('private') || q.includes('corporate')) {
    const pvtHospitals = hospitals.filter(h => h.ownership === 'Private')
    if (pvtHospitals.length > 0) {
      response += ` ${pvtHospitals.length} private hospitals found in results.`
    }
  }

  return response
}
