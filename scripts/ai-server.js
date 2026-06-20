// Standalone AI server — runs outside Next.js to prevent crashes
// This handles Z-AI SDK calls without affecting the Next.js process

const http = require('http')
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

let zaiInstance = null

async function getZAI() {
  if (zaiInstance) return zaiInstance
  const ZAI = require('z-ai-web-dev-sdk').default
  zaiInstance = await ZAI.create()
  return zaiInstance
}

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

function generateLocalResponse(query, hospitals) {
  const count = hospitals.length
  if (count === 0) {
    return `I couldn't find hospitals matching "${query}" in our database of 30,000+ hospitals. Try a city name, state, or specialty.`
  }
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

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return }

  try {
    let body = ''
    req.on('data', chunk => { body += chunk })
    await new Promise(resolve => req.on('end', resolve))
    
    const { query } = JSON.parse(body)
    if (!query) { res.writeHead(400); res.end(JSON.stringify({ error: 'Query required' })); return }

    // DB search
    const terms = query.slice(0, 100).split(/\s+/).filter(t => t.length > 1)
    const orConditions = [
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
      category: JSON.parse(h.category || '["general"]'),
      ownership: h.ownership,
      beds: parseInt(h.beds) || 0,
      emergency: h.emergency,
      specialties: (h.specialties || '').slice(0, 150),
    }))

    const parsedHospitals = hospitals.map(h => ({
      ...h,
      category: JSON.parse(h.category || '["general"]'),
      phones: JSON.parse(h.phones || '[]'),
      beds: parseInt(h.beds) || 0,
    }))

    // Z-AI
    let aiResponse = ''
    let source = 'local'
    let hasWebResults = false

    try {
      const zai = await getZAI()

      // Web search (8s timeout)
      let webContext = ''
      try {
        const webResult = await withTimeout(
          zai.functions.invoke('web_search', { query: `hospitals India ${query}` }),
          8000,
          []
        )
        if (Array.isArray(webResult) && webResult.length > 0) {
          webContext = webResult.slice(0, 3)
            .map(r => `${r.name || r.title}: ${r.snippet || ''}`)
            .join('\n')
          hasWebResults = true
        }
      } catch {}

      // AI Chat (20s timeout)
      const dirList = hospitalSummaries.length > 0
        ? hospitalSummaries.map(h => `${h.name} (${h.city}, ${h.state}) [${h.category.join('/')}] ${h.ownership} ${h.emergency ? 'ER' : ''}`).join('\n')
        : 'No matches in directory'

      const completion = await withTimeout(
        zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are MedGenome AI, a hospital finder for India (30K+ hospitals). Be concise. Bold names with **name**. Respond in user language. If web results found, mention separately as "Also on the web".' },
            { role: 'user', content: `Query: "${query}"\n\nDirectory:\n${dirList}\n\n${webContext ? `Web:\n${webContext}` : ''}\n\nRecommend hospitals.` },
          ],
          thinking: { type: 'disabled' },
        }),
        20000,
        null
      )

      if (completion?.choices?.[0]?.message?.content) {
        aiResponse = completion.choices[0].message.content
        source = 'z-ai'
      }
    } catch (e) {
      console.log('Z-AI failed:', e.message || String(e))
    }

    if (!aiResponse) {
      aiResponse = generateLocalResponse(query, hospitalSummaries)
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      response: aiResponse,
      hospitals: parsedHospitals,
      source,
      webResults: hasWebResults ? 'found' : undefined,
    }))
  } catch (error) {
    console.error('AI server error:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`AI Server running on http://localhost:${PORT}`)
})
